import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { CheckoutService } from '../src/checkout/checkout.service';
import { SafeLogger } from '../src/common/logger';

const secret = 'a'.repeat(64), origin = 'https://web.example.test';
function signed(clientKey: string, path: string, timestamp = String(Date.now()), method = 'POST') {
  return { Origin: origin, 'Sec-Fetch-Site': 'same-origin', 'X-Sorteos-Client-Key': clientKey,
    'X-Sorteos-Proxy-Time': timestamp, 'X-Sorteos-Proxy-Signature': createHmac('sha256',secret)
      .update(JSON.stringify([method,path,origin,timestamp,clientKey])).digest('hex') };
}

test('proxy real en NestJS: firma, CSRF, cookie y límites por cliente sin confianza en X-Forwarded-For', async () => {
  assert.throws(() => parseConfig({CHECKOUT_PROXY_SECRET:'short'}),/CHECKOUT_PROXY_SECRET/);
  const config = parseConfig({NODE_ENV:'test',LOG_LEVEL:'silent',CORS_ORIGINS:origin,CHECKOUT_PROXY_SECRET:secret,RATE_LIMIT:'1'});
  const identities: string[] = [];
  // HTTP/controller/CSRF/throttling are real; no production database or inventory writes.
  const module = await Test.createTestingModule({imports:[AppModule.register(config)]})
    .overrideProvider(CheckoutService).useValue({ipKey:(key:string)=>key,openSession:async (_cookie:unknown,key:string)=>{identities.push(key);return 'guest-secret';}}).compile();
  const app = module.createNestApplication({bodyParser:false,logger:false});
  configureApp(app,config,new SafeLogger('silent'));
  await app.listen(0,'127.0.0.1');
  const base = await app.getUrl(), path = '/api/v1/checkout-session';
  const post = (headers:Record<string,string>) => fetch(base+path,{method:'POST',headers});
  try {
    const first = await post(signed('1'.repeat(64),path));
    assert.equal(first.status,201); assert.deepEqual(await first.json(),{ready:true});
    assert.match(first.headers.get('set-cookie')!,/sorteos_guest=guest-secret;.*HttpOnly; SameSite=Lax/);
    assert.equal((await post(signed('1'.repeat(64),path))).status,429);
    assert.equal((await post(signed('2'.repeat(64),path))).status,201);
    assert.deepEqual(identities,['checkout-proxy-v1:'+'1'.repeat(64),'checkout-proxy-v1:'+'2'.repeat(64)]);
    for (const headers of [
      {...signed('3'.repeat(64),path),'X-Sorteos-Proxy-Signature':'0'.repeat(64)},
      signed('3'.repeat(64),path,String(Date.now()-61000)),
      signed('3'.repeat(64),path,String(Date.now()+61000)),
      signed('3'.repeat(64),path+'?other=1'),
      signed('3'.repeat(64),path,undefined,'GET'),
      {...signed('3'.repeat(64),path),Origin:'https://evil.invalid'},
      {...signed('3'.repeat(64),path),'X-Sorteos-Client-Key':'4'.repeat(64)},
      {...signed('3'.repeat(64),path),'Sec-Fetch-Site':'cross-site'},
      {'X-Sorteos-Client-Key':'5'.repeat(64)},
    ]) {
      const rejected = await post(headers); assert.equal(rejected.status,403);
      assert.equal((await rejected.json()).error.code,'FORBIDDEN');
    }
    const direct = {Origin:origin,'Sec-Fetch-Site':'same-site','X-Forwarded-For':'192.0.2.1'};
    assert.equal((await post(direct)).status,201);
    assert.equal((await post({...direct,'X-Forwarded-For':'192.0.2.2'})).status,429);
    assert.equal(identities.length,3); assert.equal(identities[2],'127.0.0.1');
  } finally { await app.close(); }
});
