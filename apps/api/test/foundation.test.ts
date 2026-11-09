import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { Controller, Get, INestApplication, Module, Post, Body } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, Min } from 'class-validator';
import { createApp, configureApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { SafeLogger } from '../src/common/logger';
import { createDocument } from '../src/openapi';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { fetchFromServer } from '../src/common/server-fetch';
import { startupFailure } from '../src/common/startup-error';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrivateStorageService } from '../src/orders/private-storage.service';
import { ReceiptService } from '../src/orders/receipt.service';
import { PDFDocument } from 'pdf-lib';
import { chooseTickets } from '../src/checkout/checkout.service';

const config = parseConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', SWAGGER_ENABLED: 'true' });

test('worker de comprobantes ignora avisos internos Node watch y procesa PDF sin cerrar la API',async()=>{
  const previous=process.env.WATCH_REPORT_DEPENDENCIES;
  process.env.WATCH_REPORT_DEPENDENCIES='1';
  try{
    const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
    const receipt=await new ReceiptService(config).validate({buffer:bytes,mimetype:'application/pdf',size:bytes.length});
    assert.equal(receipt.mime,'application/pdf');assert.deepEqual(receipt.bytes,bytes);
  }finally{if(previous===undefined)delete process.env.WATCH_REPORT_DEPENDENCIES;else process.env.WATCH_REPORT_DEPENDENCIES=previous;}
});

test('comprobantes privados de desarrollo guardan archivos reales, sin sobrescritura ni rutas arbitrarias',async()=>{
  assert.throws(()=>parseConfig({NODE_ENV:'production',DEVELOPMENT_LOCAL_RECEIPTS:'true'}));
  assert.throws(()=>parseConfig({NODE_ENV:'test',HOST:'0.0.0.0',DEVELOPMENT_LOCAL_RECEIPTS:'true'}));
  const storage=new PrivateStorageService({...config,developmentLocalReceipts:true});
  const path=`pending/${randomUUID()}.png`,bytes=Buffer.from('DEMO PRIVATE RECEIPT');
  try{
    await storage.upload(path,bytes,'image/png');
    assert.deepEqual((await storage.download(path)).bytes,bytes);
    await assert.rejects(()=>storage.upload(path,bytes,'image/png'));
    for(const invalid of ['../secret.png','pending/../secret.png','pending/invalid.png'])await assert.rejects(()=>storage.download(invalid));
    await storage.remove(path);await assert.rejects(()=>storage.download(path));
  }finally{await storage.remove(path);}
});

test('excepcion MFA de desarrollo rechaza produccion, staging, capacidad incompleta y origenes externos',()=>{
  const valid={NODE_ENV:'test',ADMIN_DEVELOPMENT_MFA_TOKEN:'a'.repeat(64),ADMIN_DEVELOPMENT_MFA_UNTIL:'2026-11-07T00:00:00Z'};
  assert.equal(parseConfig(valid).developmentMfaToken,valid.ADMIN_DEVELOPMENT_MFA_TOKEN);
  for(const change of [{NODE_ENV:'production'},{NODE_ENV:'staging'},{HOST:'0.0.0.0'},
    {ADMIN_DEVELOPMENT_MFA_TOKEN:''},{ADMIN_DEVELOPMENT_MFA_TOKEN:'invalid'},
    {ADMIN_DEVELOPMENT_MFA_UNTIL:'invalid'},{CORS_ORIGINS:'http://example.invalid'}])assert.throws(()=>parseConfig({...valid,...change}));
});

test('fallos de arranque informan causas conocidas sin reproducir secretos de excepciones', () => {
  for (const code of ['EADDRINUSE', 'EACCES', 'EADDRNOTAVAIL']) {
    const result = startupFailure({ code, message: 'SECRETO_DE_PRUEBA', password: 'SECRET' }, 3001);
    assert.equal(result.code, code);
    assert.equal(result.port, 3001);
    assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
  for (const error of [null, 'SECRET', new Error('SECRET'), { code: 'SECRET' }, { code: '__proto__' }]) {
    const result = startupFailure(error);
    assert.equal(result.code, 'STARTUP_FAILED');
    assert.ok(!JSON.stringify(result).includes('SECRET'));
    assert.ok(!('port' in result));
  }
});

test('proceso API con puerto ocupado termina con diagnostico EADDRINUSE y salida 1', async () => {
  const occupied = createServer();
  await new Promise<void>(resolve => occupied.listen(0, '127.0.0.1', resolve));
  const port = (occupied.address() as AddressInfo).port;
  try {
    const child = spawnSync(process.execPath, ['-r', 'ts-node/register', 'src/main.ts'], {
      cwd: resolve(__dirname, '..'), encoding: 'utf8', timeout: 20000, windowsHide: true,
      // This child checks runtime startup, not a second whole-project typecheck.
      // CI/typecheck validates types separately; retain the same 20s deadline and assertions.
      env: { ...process.env, VERCEL: '0', TS_NODE_TRANSPILE_ONLY: 'true', NODE_ENV: 'test', PORT: String(port), HOST: '127.0.0.1',
        LOG_LEVEL: 'silent', DATABASE_URL: '', SUPABASE_URL: '', SUPABASE_STORAGE_KEY: '',
        SUPABASE_PUBLISHABLE_KEY: '', SWAGGER_ENABLED: 'false' },
    });
    assert.ifError(child.error);
    assert.equal(child.status, 1);
    const failure = JSON.parse(child.stderr.trim());
    assert.equal(failure.event, 'startup_failed');
    assert.equal(failure.code, 'EADDRINUSE');
    assert.equal(failure.port, port);
  } finally {
    await new Promise<void>(resolve => occupied.close(() => resolve()));
  }
});

test('HTTP saliente permite elegir IPv4 sin omitir errores de red ni cancelacion',async()=>{
  const previous=process.env.HTTP_DNS_FAMILY;
  const server=createServer((_req,res)=>{res.setHeader('content-type','application/json');res.end('{"ready":true}');});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://localhost:${(server.address() as AddressInfo).port}/probe`;
  try{
    process.env.HTTP_DNS_FAMILY='6';
    await assert.rejects(fetchFromServer(url,{signal:AbortSignal.timeout(2000)}));
    for(const family of [undefined,'auto','4']){
      if(family===undefined)delete process.env.HTTP_DNS_FAMILY;else process.env.HTTP_DNS_FAMILY=family;
      const response=await fetchFromServer(url);
      assert.equal(response.status,200);assert.equal(response.ok,true);
      assert.equal(response.headers.get('content-type'),'application/json');
      assert.deepEqual(await response.json(),{ready:true});
    }
    await assert.rejects(fetchFromServer(url,{signal:AbortSignal.abort()}));
    process.env.HTTP_DNS_FAMILY='invalid';assert.throws(()=>fetchFromServer(url),/HTTP_DNS_FAMILY/);
  }finally{
    if(previous===undefined)delete process.env.HTTP_DNS_FAMILY;else process.env.HTTP_DNS_FAMILY=previous;
    server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});
let app: INestApplication;
let base: string;

before(async () => {
  app = await createApp(config);
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
after(async () => { await app?.close(); });

test('liveness real, cabeceras de seguridad y correlación', async () => {
  const response = await fetch(`${base}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.match(response.headers.get('x-request-id')!, /^[0-9a-f-]{36}$/);
});

test('sin DB, readiness falla explícitamente y liveness permanece disponible', async () => {
  const response = await fetch(`${base}/api/v1/health/ready`);
  assert.equal(response.status, 503);
  const body = await response.json() as { error: { code: string; requestId: string } };
  assert.equal(body.error.code, 'DATABASE_NOT_CONFIGURED');
  assert.equal(body.error.requestId, response.headers.get('x-request-id'));
});

test('CORS permite solo orígenes configurados', async () => {
  const allowed = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'http://localhost:3000' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:3000');
  assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
  const denied = await fetch(`${base}/api/v1/health`, { headers: { Origin: 'https://untrusted.invalid' } });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('404 uniforme no reproduce URL, tokens ni PII', async () => {
  const response = await fetch(`${base}/api/v1/missing?token=SECRETO_DE_PRUEBA`);
  assert.equal(response.status, 404);
  assert.ok(!(await response.text()).includes('SECRETO_DE_PRUEBA'));
});

test('OpenAPI se deriva de los controladores y no inventa rutas de negocio', async () => {
  const document = createDocument(app);
  assert.ok(document.paths['/api/v1/health']);
  assert.ok(document.paths['/api/v1/health/ready']);
  assert.ok(document.paths['/api/v1/raffles']);
  assert.ok(document.paths['/api/v1/orders']);
  assert.ok(document.components?.schemas?.ErrorResponseDto);
  assert.equal((await fetch(`${base}/api/v1/openapi.json`)).status, 200);
});

test('configuración rechaza orígenes comodín, números inválidos y TLS inseguro', () => {
  for (const env of [
    { CORS_ORIGINS: '*' }, { PORT: '0' }, { PORT: 'abc' }, { SWAGGER_ENABLED: 'yes' },
    { DATABASE_URL: 'postgres://localhost/demo?sslmode=no-verify' },
    { NODE_ENV: 'production', CORS_ORIGINS: 'https://example.invalid', SWAGGER_ENABLED: 'true' },
    { NODE_ENV: 'production', CORS_ORIGINS: 'https://example.invalid', DATABASE_SSL: 'false' },
  ]) assert.throws(() => parseConfig(env));
});

class InputDto {
  @IsInt() @Min(1) quantity!: number;
}

// Controlador exclusivo de pruebas: valida infraestructura sin añadir endpoints de producto.
@Controller('probe')
class ProbeController {
  @Post() echo(@Body() body: InputDto) { return body; }
  @Get('failure') failure(): never { throw new Error('SECRETO_DE_PRUEBA'); }
}
@Module({ controllers: [ProbeController] })
class ProbeModule {}

test('M6: observabilidad correlaciona errores por categoría sin URL, cabeceras, cuerpos ni PII',async()=>{
  const module=await Test.createTestingModule({imports:[ProbeModule]}).compile();
  const probe=module.createNestApplication({logger:false,bodyParser:false});
  const logger=new SafeLogger('silent'),events:unknown[]=[];
  for(const level of ['info','warn','error'] as const)logger.output[level]=((value:unknown)=>{events.push(value);}) as typeof logger.output[typeof level];
  configureApp(probe,{...config,swaggerEnabled:false},logger);await probe.listen(0,'127.0.0.1');
  try{
    const response=await fetch(`${await probe.getUrl()}/api/v1/probe/failure?token=PRIVATE_TOKEN&email=demo@example.invalid`,{headers:{Authorization:'Bearer PRIVATE_TOKEN',Cookie:'s=PRIVATE_COOKIE'}});
    assert.equal(response.status,500);
    const serialized=JSON.stringify(events);
    for(const secret of ['PRIVATE_TOKEN','PRIVATE_COOKIE','demo@example.invalid','SECRETO_DE_PRUEBA'])assert.ok(!serialized.includes(secret));
    const record=events.find(e=>typeof e==='object'&&e!==null&&'status'in e&&e.status===500) as Record<string,unknown>;
    assert.equal(record.errorCode,'INTERNAL_ERROR');assert.equal(record.routeGroup,'other');
    assert.equal(record.requestId,response.headers.get('X-Request-Id'));assert.ok(Number(record.durationMs)>=0);
  }finally{await probe.close();}
});

test('M6: asignación sin reemplazo mantiene rango y cobertura con N no decimal',()=>{
  const ids=Array.from({length:137},(_,i)=>String(i));
  const coverage=new Set<string>();
  for(let i=0;i<2000;i++){
    const picked=chooseTickets([...ids],7);assert.equal(picked.length,7);assert.equal(new Set(picked).size,7);
    for(const id of picked){assert.ok(ids.includes(id));coverage.add(id);}
  }
  assert.equal(coverage.size,137); // Smoke test for a stuck index, not a fairness certification.
});

test('validación, JSON corrupto y errores internos usan el mismo envelope', async () => {
  const module = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
  const probe = module.createNestApplication({ logger: false, bodyParser: false });
  configureApp(probe, { ...config, swaggerEnabled: false }, new SafeLogger('silent'));
  await probe.listen(0, '127.0.0.1');
  try {
    const origin = await probe.getUrl();
    for (const body of [JSON.stringify({ quantity: 0 }), JSON.stringify({ quantity: 2, secret: 'SECRET' }), '{']) {
      const response = await fetch(`${origin}/api/v1/probe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      });
      assert.equal(response.status, 400);
      const payload = await response.json() as { error: { code: string; details: object } };
      assert.equal(payload.error.code, 'INVALID_REQUEST');
      assert.deepEqual(payload.error.details, {});
    }
    const success = await fetch(`${origin}/api/v1/probe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"quantity":2}',
    });
    assert.equal(success.status, 201);
    const failure = await fetch(`${origin}/api/v1/probe/failure`);
    assert.equal(failure.status, 500);
    assert.ok(!(await failure.text()).includes('SECRETO_DE_PRUEBA'));
  } finally { await probe.close(); }
});

test('rate limiting devuelve 429 uniforme', async () => {
  const limited = await createApp({ ...config, swaggerEnabled: false, rateLimit: 1 });
  await limited.listen(0, '127.0.0.1');
  try {
    const url = `${await limited.getUrl()}/api/v1/health`;
    assert.equal((await fetch(url)).status, 200);
    const response = await fetch(url);
    assert.equal(response.status, 429);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, 'RATE_LIMITED');
  } finally { await limited.close(); }
});

test('Swagger deshabilitado no expone UI ni JSON', async () => {
  const hidden = await createApp({ ...config, swaggerEnabled: false });
  await hidden.listen(0, '127.0.0.1');
  try {
    for (const path of ['docs', 'openapi.json']) {
      assert.equal((await fetch(`${await hidden.getUrl()}/api/v1/${path}`)).status, 404);
    }
  } finally { await hidden.close(); }
});

test('DB inaccesible produce 503 sin filtrar cadena de conexión', async () => {
  const disconnected = await createApp({ ...config, swaggerEnabled: false,
    databaseUrl: 'postgres://demo:SECRET@127.0.0.1:1/demo', databaseSsl: false });
  await disconnected.listen(0, '127.0.0.1');
  try {
    const response = await fetch(`${await disconnected.getUrl()}/api/v1/health/ready`);
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.ok(text.includes('DATABASE_UNAVAILABLE'));
    assert.ok(!text.includes('SECRET'));
  } finally { await disconnected.close(); }
});
