import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { decodeProtectedHeader, exportJWK, generateKeyPair, jwtVerify, SignJWT } from 'jose';
import { Client } from 'pg';
import { createApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { localDatabaseUrl, migrateLocal, revertLocalMigrationHistory, workspaceRoot } from '../src/database/local-tools';
import { seedDemo } from '../src/database/seed-demo';
import { DatabaseService } from '../src/database/database.service';
import { AdminRaffleDto, AvailabilityDto, RafflePageDto } from '../src/catalog/catalog.dto';
import { revertEmptyB4 } from './recovery-tools';

const name = `sorteos_b1_test_b2_${process.pid}`;
const ownerId = '00000000-0000-4000-8000-000000000010';
const seedRaffle = '00000000-0000-4000-8000-000000000100';
const ownerSubject = randomUUID();
const adminSubject = randomUUID();
const inactiveSubject = randomUUID();
const outsider = randomUUID();
const loginRole = `sorteos_b2_login_${process.pid}`;
const loginPassword = randomUUID();
let owner:Client;
let db:Client;
let rootConnected = false;
let databaseCreated = false;
let loginCreated = false;
let app:INestApplication;
let issuerServer:Server;
let issuer:string;
let base:string;
let dbUrl:string;
let ownerToken:string;
let adminToken:string;
let raffleId:string;
let raffleSlug:string;
let failJwks = false;
let deletedSubject:string|undefined;
let onMediaHead:(()=>Promise<void>)|undefined;
let key:Awaited<ReturnType<typeof generateKeyPair>>;
let nextKey:Awaited<ReturnType<typeof generateKeyPair>>;

async function token(subject=ownerSubject,claims:Record<string,unknown>={},signingKey=key.privateKey,kid='primary') {
  const now = Math.floor(Date.now()/1000);
  return new SignJWT({role:'authenticated',session_id:randomUUID(),is_anonymous:false,...claims})
    .setProtectedHeader({alg:'ES256',kid}).setSubject(subject).setIssuer(`${issuer}/auth/v1`)
    .setAudience('authenticated').setIssuedAt(now).setExpirationTime(now+3600).sign(signingKey);
}

before(async()=>{
  const url = localDatabaseUrl(process.env.TEST_DATABASE_URL);
  owner = new Client({connectionString:url.toString()});
  await owner.connect(); rootConnected = true;
  await owner.query(`CREATE DATABASE ${name}`); databaseCreated = true;
  url.pathname=`/${name}`; dbUrl=url.toString();
  migrateLocal(dbUrl);
  db = new Client({connectionString:dbUrl}); await db.connect();
  await seedDemo(db);
  await db.query('UPDATE sorteos.admin_users SET auth_user_id=$1,active=true WHERE id=$2',[ownerSubject,ownerId]);
  await db.query("INSERT INTO sorteos.admin_users(auth_user_id,role,active) VALUES ($1,'ADMIN',true),($2,'ADMIN',false)",[adminSubject,inactiveSubject]);
  // UUID generado en el test: literal seguro; el login funciona también con SCRAM en CI.
  await owner.query(`CREATE ROLE ${loginRole} LOGIN PASSWORD '${loginPassword}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`);
  loginCreated=true;
  await owner.query(`GRANT sorteos_runtime TO ${loginRole}`);
  url.username=loginRole;url.password=loginPassword;dbUrl=url.toString();
  key = await generateKeyPair('ES256',{extractable:true});
  nextKey = await generateKeyPair('ES256',{extractable:true});
  const keys = [{...await exportJWK(key.publicKey),kid:'primary',alg:'ES256',use:'sig'},
    {...await exportJWK(nextKey.publicKey),kid:'rotated',alg:'ES256',use:'sig'}];
  issuerServer = createServer(async(req,res)=>{
    if (req.url==='/auth/v1/.well-known/jwks.json') {
      res.writeHead(failJwks?503:200,{'content-type':'application/json'});
      res.end(JSON.stringify(failJwks?{}:{keys})); return;
    }
    if (req.url==='/auth/v1/user') {
      try {
        assert.equal(req.headers.apikey,'sb_publishable_fixture');
        const bearer=req.headers.authorization?.slice(7)??'';
        const selected=decodeProtectedHeader(bearer).kid==='rotated'?nextKey.publicKey:key.publicKey;
        const verified=await jwtVerify(bearer,selected,{issuer:`${issuer}/auth/v1`,audience:'authenticated'});
        if (verified.payload.sub===deletedSubject) { res.writeHead(401);res.end('{}');return; }
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify({id:verified.payload.sub,is_anonymous:false}));return;
      } catch { res.writeHead(401);res.end('{}');return; }
    }
    if (req.method==='HEAD' && req.url?.startsWith('/storage/v1/object/public/raffle-media/prizes/')) {
      if (onMediaHead) { const work=onMediaHead; onMediaHead=undefined; await work(); }
      if (req.url.includes('missing')) { res.writeHead(404); res.end(); return; }
      res.writeHead(200,{'content-type':'image/webp'});res.end();return;
    }
    res.writeHead(404);res.end();
  });
  await new Promise<void>(resolve=>issuerServer.listen(0,'127.0.0.1',resolve));
  issuer=`http://127.0.0.1:${(issuerServer.address() as AddressInfo).port}`;
  app = await createApp(parseConfig({NODE_ENV:'test',LOG_LEVEL:'silent',SWAGGER_ENABLED:'false',RATE_LIMIT:'1000',
    DATABASE_URL:dbUrl,DATABASE_SSL:'false',SUPABASE_URL:issuer,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}));
  await app.listen(0,'127.0.0.1');base=await app.getUrl();
  ownerToken=await token();adminToken=await token(adminSubject);
});

after(async()=>{
  await app?.close();
  if (issuerServer) await new Promise<void>((resolve,reject)=>issuerServer.close(error=>error?reject(error):resolve()));
  await db?.end();
  if (rootConnected) {
    if (databaseCreated) await owner.query(`DROP DATABASE ${name} WITH (FORCE)`);
    if (loginCreated) await owner.query(`DROP ROLE ${loginRole}`);
    await owner.end();
  }
});

function input(slug=`demo-b2-${randomUUID()}`) {
  return {slug,title:'PREMIO DEMO B2',description:'Fixture de integración, sin venta real',prize:'PREMIO FICTICIO',
    totalTickets:100000,fundraisingTargetMinor:1000000,ticketPriceMinor:10025,minPurchase:1,maxPurchase:5,rules:'SOLO PRUEBAS, NO TRANSFERIR',
    rulesVersion:'TEST-B2-1',images:[{storageKey:'prizes/valid.webp',alt:'Imagen fixture',rightsConfirmed:true}]};
}
async function request(path:string,options:{method?:string;body?:unknown;token?:string|null;key?:string}={}) {
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if (options.token!==null) headers.Authorization=`Bearer ${options.token??ownerToken}`;
  if(options.key)headers['Idempotency-Key']=options.key;
  return fetch(`${base}/api/v1/${path}`,{method:options.method??'GET',headers,
    body:options.body===undefined?undefined:JSON.stringify(options.body)});
}
const approval = {rulesApproved:true,requirementsReviewed:true,mediaRightsConfirmed:true};

test('JWT ausente y banderas del navegador no dan acceso admin',async()=>{
  const response=await request('admin/raffles',{token:null});assert.equal(response.status,401);
  const fake=await fetch(`${base}/api/v1/admin/raffles`,{headers:{Cookie:'isAdmin=true','X-Is-Admin':'true'}});
  assert.equal(fake.status,401);
});

test('JWT con firma ajena, expirado, audiencia/emisor incorrecto y HS256 es rechazado',async()=>{
  const foreign=await generateKeyPair('ES256');
  const now=Math.floor(Date.now()/1000);
  const wrongClaims=async(audience:string,iss:string,expiration:number)=>new SignJWT({role:'authenticated',session_id:randomUUID()})
    .setProtectedHeader({alg:'ES256',kid:'primary'}).setSubject(ownerSubject).setIssuer(iss)
    .setAudience(audience).setIssuedAt(now-7200).setExpirationTime(expiration).sign(key.privateKey);
  const hs=await new SignJWT({sub:ownerSubject}).setProtectedHeader({alg:'HS256'}).sign(new Uint8Array(32));
  for (const bad of [await token(ownerSubject,{},foreign.privateKey),
    await wrongClaims('authenticated',`${issuer}/auth/v1`,now-60),
    await wrongClaims('other',`${issuer}/auth/v1`,now+3600),
    await wrongClaims('authenticated','https://other.invalid/auth/v1',now+3600),hs]) {
    assert.equal((await request('admin/raffles',{token:bad})).status,401);
  }
});

test('allowlist activa gobierna permisos; email y metadata no conceden rol',async()=>{
  for (const subject of [inactiveSubject,outsider]) {
    const signed=await token(subject,{email:'owner@example.invalid',user_metadata:{isAdmin:true,role:'OWNER'}});
    assert.equal((await request('admin/raffles',{token:signed})).status,403);
  }
  assert.equal((await request('admin/raffles',{token:await token(ownerSubject,{is_anonymous:true})})).status,401);
  assert.equal((await request('admin/raffles',{token:await token(ownerSubject,{},nextKey.privateKey,'rotated')})).status,200);
});

test('creación configura rango 00000..99999 sin materializar boletos, solo DRAFT',async()=>{
  const body=input();raffleSlug=body.slug;
  const response=await request('admin/raffles',{method:'POST',body});assert.equal(response.status,201);
  const row=await response.json() as AdminRaffleDto;raffleId=row.id;
  assert.equal(row.status,'DRAFT');assert.equal(row.availableCount,100000);assert.equal(row.numberWidth,5);
  const inventory=await db.query('SELECT count(*)::int AS n,min(number) AS min,max(number) AS max FROM sorteos.tickets WHERE raffle_id=$1',[raffleId]);
  assert.deepEqual(inventory.rows[0],{n:0,min:null,max:null});
  assert.equal(row.inventoryPolicy,'FIVE_DIGIT');assert.equal(row.fundraisingTargetMinor,1000000);assert.equal(row.progressPercent,0);
  assert.equal((await request(`raffles/${raffleSlug}`,{token:null})).status,404);
  assert.equal((await request(`admin/raffles/${raffleId}`)).status,200);
});

test('validaciones y conflicto de slug no dejan rifas ni boletos parciales',async()=>{
  const body=input();
  for (const invalid of [{...body,totalTickets:0},{...body,totalTickets:10},{...body,totalTickets:1.5},{...body,fundraisingTargetMinor:0},{...body,fundraisingTargetMinor:1.5},{...body,fundraisingTargetMinor:null},{...body,status:'PUBLISHED'},
    {...body,images:[{...body.images[0],storageKey:'receipts/private.pdf'}]}]) {
    assert.equal((await request('admin/raffles',{method:'POST',body:invalid})).status,400);
  }
  assert.equal((await request('admin/raffles',{method:'POST',body:{...body,maxPurchase:100001}})).status,422);
  assert.equal((await db.query('SELECT 1 FROM sorteos.raffles WHERE slug=$1',[body.slug])).rows.length,0);
  assert.equal((await request('admin/raffles',{method:'POST',body:input(raffleSlug)})).status,409);
  assert.equal((await request('admin/raffles/not-a-uuid')).status,400);
});

test('paginación estricta y catálogo público sin DRAFT',async()=>{
  for (const query of ['page=0','pageSize=101','pageSize=1.5','status=DRAFT']) {
    assert.equal((await request(`raffles?${query}`,{token:null})).status,400);
  }
  const result=await (await request('raffles',{token:null})).json() as RafflePageDto;
  assert.equal(result.pagination.total,0);assert.deepEqual(result.items,[]);
  const admin=await (await request('admin/raffles?status=DRAFT&pageSize=1')).json() as RafflePageDto;
  assert.equal(admin.items.length,1);assert.ok(admin.pagination.total>=2);
});

test('publicar exige OWNER, confirmaciones explícitas, derechos y objeto de imagen accesible',async()=>{
  assert.equal((await request(`admin/raffles/${raffleId}/publish`,{method:'POST',body:approval,token:adminToken})).status,403);
  assert.equal((await request(`admin/raffles/${raffleId}/publish`,{method:'POST',body:{...approval,rulesApproved:false}})).status,400);
  const noRights=await request('admin/raffles',{method:'POST',body:{...input(),images:[{storageKey:'prizes/valid.webp',alt:'Fixture',rightsConfirmed:false}]}});
  const nr=await noRights.json() as AdminRaffleDto;
  assert.equal((await request(`admin/raffles/${nr.id}/publish`,{method:'POST',body:approval})).status,422);
  const noImages=await (await request('admin/raffles',{method:'POST',body:{...input(),images:[]}})).json() as AdminRaffleDto;
  assert.equal((await request(`admin/raffles/${noImages.id}/publish`,{method:'POST',body:approval})).status,422);
  const missing=await (await request('admin/raffles',{method:'POST',body:{...input(),images:[{storageKey:'prizes/missing.webp',alt:'Fixture',rightsConfirmed:true}]}})).json() as AdminRaffleDto;
  assert.equal((await request(`admin/raffles/${missing.id}/publish`,{method:'POST',body:approval})).status,422);
  assert.equal((await request(`admin/raffles/${raffleId}/publish`,{method:'POST',body:approval})).status,200);
});

test('bootstrap local explícito es reejecutable y habilita solo al sujeto Auth indicado',async()=>{
  const bootName=`${name}_bootstrap`;
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL);url.pathname=`/${bootName}`;
  await owner.query(`CREATE DATABASE ${bootName}`);
  const bootDb=new Client({connectionString:url.toString()});
  try {
    migrateLocal(url.toString());await bootDb.connect();
    const subject=randomUUID();
    const env={...process.env,NODE_ENV:'test',DATABASE_URL:url.toString(),DATABASE_SSL:'false',SUPABASE_URL:issuer,
      SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',PROVISION_LOCAL_ADMIN:'true',LOCAL_ADMIN_USER_ID:subject,LOCAL_ADMIN_ROLE:'OWNER'};
    for (let attempt=0;attempt<2;attempt++) execFileSync(process.execPath,
      ['-r','ts-node/register','src/auth/provision-local-admin.ts'],
      {cwd:resolve(workspaceRoot,'apps/api'),env,stdio:['ignore','pipe','pipe'],timeout:15000});
    const rows=await bootDb.query('SELECT auth_user_id,role,active FROM sorteos.admin_users');
    assert.deepEqual(rows.rows,[{auth_user_id:subject,role:'OWNER',active:true}]);
    assert.equal((await bootDb.query("SELECT count(*)::int AS n FROM sorteos.audit_logs WHERE entity='admin_users'")).rows[0].n,1);
    const bootApp=await createApp(parseConfig({NODE_ENV:'test',LOG_LEVEL:'silent',SWAGGER_ENABLED:'false',
      DATABASE_URL:url.toString(),DATABASE_SSL:'false',SUPABASE_URL:issuer,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}));
    await bootApp.listen(0,'127.0.0.1');
    try {
      const response=await fetch(`${await bootApp.getUrl()}/api/v1/admin/raffles`,{headers:{Authorization:`Bearer ${await token(subject)}`}});
      assert.equal(response.status,200);
    } finally { await bootApp.close(); }
  } finally {
    await bootDb.end();await owner.query(`DROP DATABASE ${bootName} WITH (FORCE)`);
  }
});

test('detalle y disponibilidad públicos separan vendidos/reservados y no exponen datos privados',async()=>{
  const list=await (await request('raffles',{token:null})).json() as RafflePageDto;
  assert.equal(list.pagination.total,1);assert.equal(list.items[0]!.status,'PUBLISHED');
  const availability=await (await request(`raffles/${raffleSlug}/availability`,{token:null})).json() as AvailabilityDto;
  assert.deepEqual({...availability,asOf:undefined},{total:100000,available:100000,held:0,reserved:0,sold:0,asOf:undefined});
  const detail=await (await request(`raffles/${raffleSlug}`,{token:null})).text();
  for (const secret of ['customer','ticketNumbers','session_id','lookup_secret_hash','receipt','rightsConfirmed',ownerSubject]) {
    assert.ok(!detail.includes(secret));
  }
  const beyond=await (await request('raffles?page=100',{token:null})).json() as RafflePageDto;
  assert.equal(beyond.pagination.total,1);assert.equal(beyond.items.length,0);
});

test('pausar oculta la rifa y exige volver a confirmar para reanudar',async()=>{
  assert.equal((await request(`admin/raffles/${raffleId}`,{method:'PATCH',body:{title:'No editar publicada'}})).status,409);
  assert.equal((await request(`admin/raffles/${raffleId}/pause`,{method:'POST',token:adminToken})).status,200);
  assert.equal((await request(`raffles/${raffleSlug}`,{token:null})).status,404);
  assert.equal((await request(`admin/raffles/${raffleId}`,{method:'PATCH',body:{title:'NUEVO TITULO DEMO'}})).status,200);
  assert.equal((await request(`admin/raffles/${raffleId}/resume`,{method:'POST',body:approval})).status,200);
  assert.equal((await request(`admin/raffles/${raffleId}/resume`,{method:'POST',body:approval})).status,409);
});

test('precio/N comprometidos quedan bloqueados y los importes siguen siendo enteros exactos',async()=>{
  for (const patch of [{totalTickets:101},{ticketPriceMinor:1}]) {
    assert.equal((await request(`admin/raffles/${seedRaffle}`,{method:'PATCH',body:patch})).status,409);
  }
  assert.equal((await request(`admin/raffles/${seedRaffle}`,{method:'PATCH',body:{title:null}})).status,422);
});

test('publicación detecta edición concurrente durante HEAD, sin mantener transacción abierta',async()=>{
  const created=await (await request('admin/raffles',{method:'POST',body:input()})).json() as AdminRaffleDto;
  onMediaHead=async()=>{
    await db.query("SET lock_timeout='1s'");
    await db.query("UPDATE sorteos.raffles SET title='EDICION CONCURRENTE DEMO' WHERE id=$1",[created.id]);
  };
  const response=await request(`admin/raffles/${created.id}/publish`,{method:'POST',body:approval});
  assert.equal(response.status,409);
  const body=await response.json() as {error:{code:string}};assert.equal(body.error.code,'CONCURRENT_MODIFICATION');
});

test('cuentas públicas excluyen las DEMO/inactivas y solo devuelven campos destinados a transferencias',async()=>{
  assert.deepEqual(await (await request('bank-accounts/public',{token:null})).json(),{items:[]});
  await db.query(`INSERT INTO sorteos.bank_accounts(bank_name,holder_name,account_type,account_display,active)
    VALUES ('BANCO FIXTURE SIN EXISTENCIA','TITULAR DE PRUEBA','CHECKING','DEMO-SIN-NUMERO-REAL',true)`);
  const result=await (await request('bank-accounts/public',{token:null})).json() as {items:Record<string,unknown>[]};
  assert.equal(result.items.length,1);
  assert.deepEqual(Object.keys(result.items[0]!).sort(),['accountDisplay','accountType','bankName','currency','holderName','id']);
});

test('rol NestJS no puede modificar administradores ni consultar clientes/comprobantes',async()=>{
  const database=app.get(DatabaseService);
  assert.equal(await database.transaction(async client=>(await client.query('SELECT current_user')).rows[0].current_user),'sorteos_runtime');
  for (const sql of ["UPDATE sorteos.admin_users SET active=true",'SELECT * FROM sorteos.customers','SELECT * FROM sorteos.payment_reports']) {
    await assert.rejects(()=>database.transaction(async client=>{await client.query(sql);}));
  }
});

test('desactivar allowlist revoca acceso aun con JWT vigente; accesos y publicación quedan auditados',async()=>{
  await db.query('UPDATE sorteos.admin_users SET active=false WHERE auth_user_id=$1',[adminSubject]);
  assert.equal((await request('admin/raffles',{token:adminToken})).status,403);
  const audits=await db.query("SELECT action,actor_id,request_id FROM sorteos.audit_logs WHERE action IN ('ADMIN_ACCESS_DENIED','PUBLICATION_ATTESTATION')");
  assert.ok(audits.rows.some(row=>row.action==='PUBLICATION_ATTESTATION'&&row.actor_id===ownerId));
  assert.ok(audits.rows.some(row=>row.action==='ADMIN_ACCESS_DENIED'));
  assert.ok(audits.rows.every(row=>row.request_id));
});

test('conteos públicos diferencian reservas pendientes de ventas bancarias verificadas',async()=>{
  const legacy=await (await request(`admin/raffles/${seedRaffle}`)).json() as AdminRaffleDto;
  assert.equal(legacy.totalTickets,100);assert.equal(legacy.inventoryPolicy,'LEGACY');assert.equal(legacy.progressPercent,null);assert.equal(legacy.numberWidth,5);
  assert.equal((await request(`admin/raffles/${seedRaffle}/fundraising-target`,{method:'POST',key:randomUUID(),body:{fundraisingTargetMinor:30075,expectedVersion:legacy.version,reason:'Objetivo de prueba sin dinero real'}})).status,200);
  assert.equal((await request(`admin/raffles/${seedRaffle}`,{method:'PATCH',body:{images:input().images}})).status,200);
  assert.equal((await request(`admin/raffles/${seedRaffle}/publish`,{method:'POST',body:approval})).status,200);
  const before=await (await request('raffles/demo-b1-100',{token:null})).json() as AdminRaffleDto;
  assert.equal(before.reservedCount,3);assert.equal(before.confirmedSoldCount,0);assert.equal(before.availableCount,97);
  assert.equal(before.progressPercent,0);
  // Fixture SQL exclusivamente: el endpoint de aprobación de pagos pertenece a B5.
  await db.query('BEGIN');
  try {
    await db.query(`UPDATE sorteos.payment_reports SET status='VERIFIED',verified_amount_minor=30075,
      bank_posted_at=now(),bank_confirmation_reference='DEMO-NO-REAL',reviewer_id=$1,reviewed_at=now()
      WHERE order_id='00000000-0000-4000-8000-000000000600'`,[ownerId]);
    await db.query(`UPDATE sorteos.orders SET status='PAID',reviewed_by=$1,reviewed_at=now()
      WHERE id='00000000-0000-4000-8000-000000000600'`,[ownerId]);
    await db.query("UPDATE sorteos.tickets SET status='SOLD' WHERE raffle_id=$1 AND status='RESERVED'",[seedRaffle]);
    await db.query('COMMIT');
  } catch(error) { await db.query('ROLLBACK');throw error; }
  const after=await (await request('raffles/demo-b1-100',{token:null})).json() as AdminRaffleDto;
  assert.equal(after.reservedCount,0);assert.equal(after.confirmedSoldCount,3);assert.equal(after.availableCount,97);
  assert.equal(after.progressPercent,100);
});

test('objetivo editable publicado, auditable e idempotente; progreso privado y compra al 100%',async()=>{
  const path=`admin/raffles/${seedRaffle}/fundraising-target`;
  let row=await (await request(`admin/raffles/${seedRaffle}`)).json() as AdminRaffleDto;
  const body={fundraisingTargetMinor:60150,expectedVersion:row.version,reason:'Aumentar objetivo DEMO'};
  const key=randomUUID();
  assert.equal((await request(path,{method:'POST',body})).status,400);
  assert.equal((await request(path,{method:'POST',body,key,token:adminToken})).status,403);
  const response=await request(path,{method:'POST',body,key});assert.equal(response.status,200);const result=await response.json();
  assert.deepEqual(await (await request(path,{method:'POST',body,key})).json(),result);
  assert.equal((await request(path,{method:'POST',body:{...body,fundraisingTargetMinor:1},key})).status,409);
  assert.equal((await request(path,{method:'POST',body,key:randomUUID()})).status,409);
  row=await (await request(`admin/raffles/${seedRaffle}`)).json() as AdminRaffleDto;
  assert.equal(row.progressPercent,50);assert.equal(row.confirmedAmountMinor,'30075');assert.equal(row.actualProgressPercent,'50');
  const publicResponse=await request('raffles/demo-b1-100',{token:null});assert.equal(publicResponse.headers.get('cache-control'),'no-store');
  const publicRow=await publicResponse.json() as Record<string,unknown>;assert.equal(publicRow.progressPercent,50);
  for(const field of ['fundraisingTargetMinor','confirmedAmountMinor','actualProgressPercent','inventoryPolicy'])assert.ok(!(field in publicRow));
  assert.equal((await request(`admin/raffles/${seedRaffle}`,{method:'PATCH',body:{fundraisingTargetMinor:1}})).status,400);
  const changed=await request(path,{method:'POST',body:{...body,expectedVersion:row.version,fundraisingTargetMinor:1},key:randomUUID()});assert.equal(changed.status,200);
  assert.equal((await (await request('raffles/demo-b1-100',{token:null})).json() as AdminRaffleDto).progressPercent,100);
  const origin='http://localhost:3000';
  const session=await fetch(`${base}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin}});assert.equal(session.status,201);
  const hold=await fetch(`${base}/api/v1/checkout-holds`,{method:'POST',headers:{Origin:origin,Cookie:session.headers.get('set-cookie')!.split(';')[0]!,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({raffleId:seedRaffle,quantity:1})});
  assert.equal(hold.status,201);assert.ok(!('ticketNumbers' in (await hold.json() as object)));
  const audit=await db.query("SELECT metadata FROM sorteos.audit_logs WHERE action='FUNDRAISING_TARGET_CHANGED' AND metadata->>'idempotencyKey'=$1",[key]);
  assert.equal(audit.rowCount,1);assert.equal(audit.rows[0].metadata.previousTargetMinor,'30075');assert.equal(audit.rows[0].metadata.nextTargetMinor,'60150');
});

test('rango implícito crea únicamente los números del hold, sin colisiones ni duplicados por retry',async()=>{
  const origin='http://localhost:3000';
  const initial=(await db.query('SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1',[raffleId])).rows[0].n;
  async function session(){const r=await fetch(`${base}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin}});assert.equal(r.status,201);return r.headers.get('set-cookie')!.split(';')[0]!;}
  const cookies=await Promise.all([session(),session()]),keys=[randomUUID(),randomUUID()];
  async function hold(i:number){return fetch(`${base}/api/v1/checkout-holds`,{method:'POST',headers:{Origin:origin,Cookie:cookies[i]!,'Idempotency-Key':keys[i]!,'Content-Type':'application/json'},body:JSON.stringify({raffleId,quantity:3})});}
  const responses=await Promise.all([hold(0),hold(1)]);
  for(const response of responses)assert.equal(response.status,201);
  const holds=await Promise.all(responses.map(r=>r.json() as Promise<{holdId:string}>));
  const rows=await db.query('SELECT number,hold_id FROM sorteos.tickets WHERE hold_id=ANY($1::uuid[])',[holds.map(h=>h.holdId)]);
  assert.equal(rows.rowCount,6);assert.equal(new Set(rows.rows.map(r=>r.number)).size,6);assert.ok(rows.rows.every(r=>r.number>=0&&r.number<100000));
  const count=(await db.query('SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1',[raffleId])).rows[0].n;
  assert.ok(count<=initial+6);assert.ok(count<100000);
  for(let i=0;i<2;i++){assert.equal((await hold(i)).status,201);assert.equal((await fetch(`${base}/api/v1/checkout-holds/${holds[i]!.holdId}`,{method:'DELETE',headers:{Origin:origin,Cookie:cookies[i]!}})).status,200);}
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1',[raffleId])).rows[0].n,count);
  const stock=await (await request(`raffles/${raffleSlug}/availability`,{token:null})).json() as AvailabilityDto;
  assert.equal(stock.total,stock.available+stock.held+stock.reserved+stock.sold);
});

test('disponibilidad computa HELD vigentes y no expira órdenes ni muta inventario al leer',async()=>{
  const expired=randomUUID();const active=randomUUID();
  await db.query('BEGIN');
  try {
    for (const [id,number,old] of [[expired,3,true],[active,4,false]] as const) {
      // Sparse inventory: this fixture must materialize its own chosen numbers.
      await db.query('INSERT INTO sorteos.tickets(raffle_id,number) VALUES($1,$2) ON CONFLICT(raffle_id,number) DO NOTHING',[raffleId,number]);
      await db.query(`INSERT INTO sorteos.checkout_holds(id,raffle_id,session_id,quantity,unit_price_minor_snapshot,
        rules_version_snapshot,created_at,expires_at,idempotency_key,request_hash)
        VALUES ($1,$2,'00000000-0000-4000-8000-000000000400',1,10025,'TEST-B2-1',
        now()-interval '2 hours',now()+$3::interval,$4,$5)`,[id,raffleId,old?'-1 hour':'1 hour',randomUUID(),'f'.repeat(64)]);
      await db.query("UPDATE sorteos.tickets SET status='HELD',hold_id=$1 WHERE raffle_id=$2 AND number=$3",[id,raffleId,number]);
    }
    await db.query('COMMIT');
  } catch(error) { await db.query('ROLLBACK');throw error; }
  const result=await (await request(`raffles/${raffleSlug}/availability`,{token:null})).json() as AvailabilityDto;
  assert.deepEqual({...result,asOf:undefined},{total:100000,available:99999,held:1,reserved:0,sold:0,asOf:undefined});
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1 AND status='HELD'",[raffleId])).rows[0].n,2);
});

test('sin JWKS disponible o configuración Auth se rechaza en modo cerrado',async()=>{
  for (const configured of [false,true]) {
    failJwks=true;
    const other=await createApp(parseConfig({NODE_ENV:'test',LOG_LEVEL:'silent',SWAGGER_ENABLED:'false',
      DATABASE_URL:dbUrl,DATABASE_SSL:'false',SUPABASE_URL:configured?issuer:undefined,
      SUPABASE_PUBLISHABLE_KEY:configured?'sb_publishable_fixture':undefined}));
    await other.listen(0,'127.0.0.1');
    try {
      const response=await fetch(`${await other.getUrl()}/api/v1/admin/raffles`,{headers:{Authorization:`Bearer ${ownerToken}`}});
      assert.equal(response.status,503);
    } finally { await other.close(); }
  }
  failJwks=false;
});

test('un usuario eliminado en Auth no conserva acceso por tener JWT vigente y allowlist activa',async()=>{
  deletedSubject=ownerSubject;
  try { assert.equal((await request('admin/raffles')).status,401); }
  finally { deletedSubject=undefined; }
});

test('recuperación B2 conserva B1, repara historial oficial y permite reaplicar; con datos se bloquea',async()=>{
  const down=await readFile(resolve(workspaceRoot,'infra/recovery/b2-down-empty.sql'),'utf8');
  await db.query('BEGIN');
  try { await assert.rejects(()=>db.query(down),/Rollback B2 bloqueado/); }
  finally { await db.query('ROLLBACK'); }
  const recoveryName=`${name}_b2_recovery`;
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL);url.pathname=`/${recoveryName}`;
  await owner.query(`CREATE DATABASE ${recoveryName}`);
  const recovery=new Client({connectionString:url.toString()});
  try {
    migrateLocal(url.toString());await recovery.connect();
    await revertEmptyB4(recovery,url.toString());
    const b3=await recovery.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name='checkout_holds_b3'");
    if(b3.rows[0]) {
      await recovery.query('BEGIN');
      await recovery.query(await readFile(resolve(workspaceRoot,'infra/recovery/b3-down-empty.sql'),'utf8'));
      await recovery.query('COMMIT');
      revertLocalMigrationHistory(url.toString(),b3.rows[0].version);
    }
    const history=await recovery.query<{version:string}>('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1');
    await recovery.query('BEGIN');await recovery.query(down);await recovery.query('COMMIT');
    assert.equal((await recovery.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos'")).rows[0].n,13);
    assert.equal((await recovery.query("SELECT 1 FROM information_schema.columns WHERE table_schema='sorteos' AND table_name='raffles' AND column_name='version'")).rowCount,0);
    assert.equal((await recovery.query("SELECT has_schema_privilege('sorteos_runtime','sorteos','USAGE') AS allowed")).rows[0].allowed,false);
    assert.equal((await recovery.query("SELECT has_column_privilege('sorteos_runtime','sorteos.checkout_holds','id','SELECT') AS allowed")).rows[0].allowed,false);
    revertLocalMigrationHistory(url.toString(),history.rows[0]!.version);
    migrateLocal(url.toString());
    assert.equal((await recovery.query("SELECT 1 FROM information_schema.columns WHERE table_schema='sorteos' AND table_name='raffles' AND column_name='version'")).rowCount,1);
  } finally { await recovery.end();await owner.query(`DROP DATABASE ${recoveryName} WITH (FORCE)`); }
});
