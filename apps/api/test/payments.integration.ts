import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { generateKeyPair, exportJWK, SignJWT, jwtVerify } from 'jose';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import sharp from 'sharp';
import { createApp } from '../src/bootstrap';
import { APP_CONFIG, AppConfig, parseConfig } from '../src/config/config';
import { localDatabaseUrl, migrateLocal } from '../src/database/local-tools';
import { seedDemo } from '../src/database/seed-demo';
import { revertEmptyB5 } from './recovery-tools';
import { AdminOrderDetailDto, AdminOrdersPageDto, FinancialResultDto } from '../src/payments/payments.dto';
import { CheckoutService } from '../src/checkout/checkout.service';
import { DatabaseService } from '../src/database/database.service';
import { DevelopmentWorkflowSetup } from '../src/development/prepare-workflow';
import { OperationSummaryDto } from '../src/operations/operations.dto';
import { csvCell } from '../src/operations/operations.service';
import { FinancialAuthorization } from '../src/auth/financial.guard';
import { TicketLookupResultDto } from '../src/ticket-lookup/lookup.dto';
import { maskHalf, maskLookupEmail } from '../src/ticket-lookup/lookup.core';

type TestBody=FinancialResultDto & AdminOrderDetailDto & AdminOrdersPageDto & {error:{code:string};url:string;access:string;holdId:string};
async function fetch(...args:Parameters<typeof globalThis.fetch>){return await globalThis.fetch(...args) as Omit<Response,'json'>&{json():Promise<TestBody>};}
const name=`sorteos_b1_test_b5_${process.pid}`,login=`sorteos_b5_login_${process.pid}`,password=randomUUID();
const ownerSubject=randomUUID(),staffSubject=randomUUID(),outsider=randomUUID(),ownerId='00000000-0000-4000-8000-000000000010';
const bankId=randomUUID(),origin='http://localhost:3000';
const objects=new Map<string,Buffer>();
let root:Client,db:Client,server:Server,app:INestApplication,peer:INestApplication;
let connected=false,created=false,loginCreated=false,base:string,peerBase:string,issuer:string,png:Buffer;
let keys:Awaited<ReturnType<typeof generateKeyPair>>,ownerToken:string,staffToken:string;
let onDownload:(()=>Promise<void>)|undefined,publicBucket=false,downloadCount=0;
let publicPrizeBucket=true;
async function authFixture(c:Client) {
  await c.query(`CREATE SCHEMA auth;
    CREATE TABLE auth.mfa_factors(id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,factor_type text NOT NULL,secret text DEFAULT 'DO_NOT_READ');
    CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL,not_after timestamptz,aal text,factor_id uuid REFERENCES auth.mfa_factors(id),refresh_token text DEFAULT 'DO_NOT_READ');
    ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;`);
}
async function token(subject=ownerSubject,options:{aal?:string;mfaAt?:number;sessionId?:string;dbUser?:string}={}) {
  const sessionId=options.sessionId??randomUUID(),factor=randomUUID();
  if(!options.sessionId){
    await db.query("INSERT INTO auth.mfa_factors(id,user_id,status,factor_type) VALUES($1,$2,'verified','totp')",[factor,options.dbUser??subject]);
    await db.query("INSERT INTO auth.sessions(id,user_id,aal,factor_id) VALUES($1,$2,'aal2',$3)",[sessionId,options.dbUser??subject,factor]);
  }
  const now=Math.floor(Date.now()/1000);
  const jwt=await new SignJWT({role:'authenticated',session_id:sessionId,is_anonymous:false,aal:options.aal??'aal2',
    amr:[{method:'totp',timestamp:options.mfaAt??now}]}).setProtectedHeader({alg:'ES256',kid:'primary'})
    .setSubject(subject).setIssuer(`${issuer}/auth/v1`).setAudience('authenticated').setIssuedAt(now).setExpirationTime(now+3600).sign(keys.privateKey);
  return jwt;
}
before(async()=>{
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL);root=new Client({connectionString:url.toString()});await root.connect();connected=true;
  await root.query(`CREATE DATABASE ${name}`);created=true;url.pathname=`/${name}`;
  db=new Client({connectionString:url.toString()});await db.connect();await authFixture(db);migrateLocal(url.toString());await seedDemo(db);
  // Reproduce hosted Supabase: custom roles cannot use the managed auth schema.
  await db.query('REVOKE USAGE ON SCHEMA auth FROM sorteos_runtime');
  await db.query('UPDATE sorteos.admin_users SET auth_user_id=$1,active=true WHERE id=$2',[ownerSubject,ownerId]);
  await db.query("INSERT INTO sorteos.admin_users(auth_user_id,role,active) VALUES($1,'ADMIN',true)",[staffSubject]);
  await db.query("INSERT INTO sorteos.bank_accounts(id,bank_name,holder_name,account_type,account_display,active) VALUES($1,'BANCO DEMO','NO REAL','SAVINGS','NO TRANSFERIR - SIN CUENTA REAL',true)",[bankId]);
  keys=await generateKeyPair('ES256',{extractable:true});const jwk={...await exportJWK(keys.publicKey),kid:'primary',alg:'ES256',use:'sig'};
  server=createServer(async(req,res)=>{
    try{
      if(req.url==='/auth/v1/.well-known/jwks.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify({keys:[jwk]}));return;}
      if(req.url==='/auth/v1/user'){
        assert.equal(req.headers.apikey,'sb_publishable_b5_fixture');
        const verified=await jwtVerify(req.headers.authorization?.slice(7)??'',keys.publicKey,{issuer:`${issuer}/auth/v1`,audience:'authenticated'});
        res.setHeader('content-type','application/json');res.end(JSON.stringify({id:verified.payload.sub,is_anonymous:false}));return;
      }
      if(req.method==='HEAD'&&req.url?.startsWith('/storage/v1/object/public/raffle-media/prizes/')){
        res.writeHead(objects.has('media:'+req.url.slice('/storage/v1/object/public/raffle-media/'.length))?200:404,{'content-type':'image/webp'});res.end();return;
      }
      assert.equal(req.headers.apikey,'sb_secret_b5_fixture_server_only');
      if(req.method==='GET'&&req.url==='/storage/v1/bucket/raffle-media'){res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'raffle-media',name:'raffle-media',public:publicPrizeBucket}));return;}
      if(req.method==='POST'&&req.url?.startsWith('/storage/v1/object/raffle-media/prizes/')){
        const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
        const path=req.url.slice('/storage/v1/object/raffle-media/'.length);objects.set('media:'+path,Buffer.concat(chunks));res.setHeader('content-type','application/json');res.end(JSON.stringify({Key:`raffle-media/${path}`}));return;
      }
      if(req.method==='GET'&&req.url==='/storage/v1/bucket/receipts'){res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'receipts',name:'receipts',public:publicBucket}));return;}
      if(req.method==='POST'&&req.url?.startsWith('/storage/v1/object/receipts/pending/')){
        const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
        const path=req.url.slice('/storage/v1/object/receipts/'.length);objects.set(path,Buffer.concat(chunks));res.setHeader('content-type','application/json');res.end(JSON.stringify({Key:`receipts/${path}`}));return;
      }
      if(req.method==='GET'&&req.url?.startsWith('/storage/v1/object/receipts/')){
        downloadCount++;if(onDownload)await onDownload();
        const bytes=objects.get(req.url.slice('/storage/v1/object/receipts/'.length));
        if(!bytes){res.writeHead(404);res.end('{}');return;}
        res.setHeader('content-type','image/png');res.end(bytes);return;
      }
      if(req.method==='DELETE'){let data='';for await(const chunk of req)data+=String(chunk);for(const path of (JSON.parse(data) as {prefixes:string[]}).prefixes)objects.delete(path);res.setHeader('content-type','application/json');res.end('[]');return;}
      res.writeHead(404);res.end('{}');
    }catch{res.writeHead(401);res.end('{}');}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));issuer=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  await root.query(`CREATE ROLE ${login} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);loginCreated=true;await root.query(`GRANT sorteos_runtime TO ${login}`);
  url.username=login;url.password=password;
  const config=parseConfig({NODE_ENV:'test',LOG_LEVEL:'silent',SWAGGER_ENABLED:'false',DATABASE_URL:url.toString(),DATABASE_SSL:'false',
    SUPABASE_URL:issuer,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_b5_fixture',SUPABASE_STORAGE_KEY:'sb_secret_b5_fixture_server_only',
    RATE_LIMIT:'10000',HOLD_MAX_ACTIVE_IP:'1000',HOLD_HOURLY_IP:'10000',CHECKOUT_SESSION_HOURLY_IP:'10000',HOLD_SWEEP_MS:'3600000',CHECKOUT_ABUSE_HASH_KEY:'b5-fixture-'.repeat(4)});
  app=await createApp(config);await app.listen(0,'127.0.0.1');base=await app.getUrl();peer=await createApp(config);await peer.listen(0,'127.0.0.1');peerBase=await peer.getUrl();
  ownerToken=await token();staffToken=await token(staffSubject);png=await sharp({create:{width:2,height:2,channels:3,background:'#fff'}}).png().toBuffer();
});
after(async()=>{
  await app?.close();await peer?.close();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await db?.end();
  if(connected){if(created)await root.query(`DROP DATABASE ${name} WITH(FORCE)`);if(loginCreated)await root.query(`DROP ROLE ${login}`);await root.end();}
});
async function order(quantity=3,beforePublish?:(raffle:string)=>Promise<void>) {
  const raffle=randomUUID();
  await db.query(`INSERT INTO sorteos.raffles(inventory_policy,id,slug,title,description,prize,total_tickets,ticket_price_minor,min_purchase,max_purchase,rules,rules_version) VALUES ('LEGACY',$1,$2,'RIFA DEMO B5','SOLO TEST','PREMIO FICTICIO',10,10025,1,5,'NO TRANSFERIR','B5-1')`,[raffle,`demo-${raffle}`]);
  if(beforePublish)await beforePublish(raffle);
  await db.query("INSERT INTO sorteos.raffle_media(raffle_id,storage_key,alt,position,rights_confirmed) VALUES($1,'prizes/test.webp','Fixture',0,true)",[raffle]);
  await db.query("UPDATE sorteos.raffles SET status='PUBLISHED',publication_approved_by=$2,publication_approved_at=now(),approved_rules_version=rules_version WHERE id=$1",[raffle,ownerId]);
  const session=await fetch(`${base}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin}});assert.equal(session.status,201);const cookie=session.headers.get('set-cookie')!.split(';')[0]!;
  const hold=await fetch(`${base}/api/v1/checkout-holds`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({raffleId:raffle,quantity})});assert.equal(hold.status,201);
  const holdId=(await hold.json()).holdId,reference=`REF-DEMO-${randomUUID()}`;
  const form=new FormData();for(const [key,value]of Object.entries({holdId,customerName:'CLIENTE DEMO B5',customerPhone:'+18095550100',customerEmail:'b5-demo@example.invalid',bankAccountId:bankId,bankReference:reference,transferDate:new Date().toISOString(),acceptedRulesVersion:'B5-1'}))form.append(key,value);
  form.append('receipt',new Blob([new Uint8Array(png)],{type:'image/png'}),'fixture.png');
  const submitted=await fetch(`${base}/api/v1/orders`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Idempotency-Key':randomUUID()},body:form});assert.equal(submitted.status,201);
  const body=await submitted.json();const row=(await db.query('SELECT id,version FROM sorteos.orders WHERE order_code=$1',[body.orderCode])).rows[0];
  const report=(await db.query('SELECT id,receipt_storage_path FROM sorteos.payment_reports WHERE order_id=$1',[row.id])).rows[0];
  return {id:row.id as string,version:row.version as number,raffle,holdId,reportId:report.id as string,path:report.receipt_storage_path as string,total:quantity*10025,quantity,reference,orderCode:body.orderCode,cookie};
}
type Fixture=Awaited<ReturnType<typeof order>>;
function request(path:string,options:{method?:string;body?:unknown;token?:string|null;key?:string;api?:string}={}){
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(options.token!==null)headers.Authorization=`Bearer ${options.token??ownerToken}`;
  if(options.key)headers['Idempotency-Key']=options.key;
  return fetch(`${options.api??base}/api/v1/admin/${path}`,{method:options.method??'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body)});
}
function action(c:Fixture,name:string,body:Record<string,unknown>,options:{token?:string;key?:string;api?:string}={}) {
  return request(`orders/${c.id}/${name}`,{...options,method:'POST',key:options.key??randomUUID(),body:{expectedVersion:c.version,...body}});
}
const approval=(c:Fixture)=>({verifiedAmountMinor:c.total,bankPostedAt:new Date().toISOString(),bankConfirmationReference:`CONFIRMED-${randomUUID()}`,
  note:'Verificado manualmente en extracto DEMO, sin transferencia real.',bankVerified:true,duplicateSignalsReviewed:true});
const cancellation=()=>({resolutionType:'NOT_PAID_CONFIRMED',reason:'Sin ingreso tras conciliación DEMO documentada.',evidenceReference:`INC-DEMO-${randomUUID()}`,reconciliationConfirmed:true});
async function counts(c:Fixture){return (await db.query(`SELECT count(*) FILTER(WHERE status='AVAILABLE')::int AS available,
  count(*) FILTER(WHERE status='RESERVED')::int AS reserved,count(*) FILTER(WHERE status='SOLD')::int AS sold FROM sorteos.tickets WHERE raffle_id=$1`,[c.raffle])).rows[0];}
test('M4 sesión administrativa verifica rol, sesión vigente y MFA sin exponer tokens o datos personales',async()=>{
  assert.equal((await request('session',{token:null})).status,401);
  assert.equal((await request('session',{token:await token(outsider)})).status,403);
  const initial=await request('session',{token:await token(ownerSubject,{aal:'aal1'})});
  assert.equal(initial.status,200);assert.equal(initial.headers.get('cache-control'),'no-store');
  assert.deepEqual(await initial.json(),{adminId:ownerId,role:'OWNER',mfaRequired:true,mfaVerifiedUntil:null,developmentAccessUntil:null});
  const verified=await request('session');assert.equal(verified.status,200);
  const body=await verified.json() as unknown as {role:string;mfaRequired:boolean;mfaVerifiedUntil:string};
  assert.equal(body.role,'OWNER');assert.equal(body.mfaRequired,false);assert.ok(Date.parse(body.mfaVerifiedUntil)>Date.now());
  const revoked=await token(ownerSubject,{aal:'aal1'}),payload=JSON.parse(Buffer.from(revoked.split('.')[1]!,'base64url').toString()) as {session_id:string};
  await db.query('DELETE FROM auth.sessions WHERE id=$1',[payload.session_id]);
  assert.equal((await request('session',{token:revoked})).status,401);
});

test('capacidad de desarrollo permite proceso AAL1 auditado; falla con token, admin, sesion o plazo incorrectos',async()=>{
  const capability=randomBytes(32).toString('hex'),until=new Date(Date.now()+3600000).toISOString();
  const config={...app.get<AppConfig>(APP_CONFIG),developmentMfaToken:capability,developmentMfaUntil:until};
  const dev=await createApp(config),bad=await createApp({...config,developmentMfaToken:'a'.repeat(64)});
  await dev.listen(0,'127.0.0.1');await bad.listen(0,'127.0.0.1');
  const devBase=await dev.getUrl(),badBase=await bad.getUrl();
  const jwt=await token(ownerSubject,{aal:'aal1',mfaAt:0}),sid=JSON.parse(Buffer.from(jwt.split('.')[1]!,'base64url').toString()).session_id as string;
  await db.query("UPDATE auth.sessions SET aal='aal1',factor_id=NULL WHERE id=$1",[sid]);
  const setupUrl=localDatabaseUrl(process.env.TEST_DATABASE_URL);setupUrl.pathname=`/${name}`;
  const setup=new DevelopmentWorkflowSetup({...config,databaseUrl:setupUrl.toString(),developmentLocalReceipts:true});
  assert.equal((await setup.prepare()).demo,true);assert.equal((await setup.prepare()).slug,'demo-prueba-completa');
  const later=new Date(Date.now()+5400000).toISOString();
  await new DevelopmentWorkflowSetup({...config,databaseUrl:setupUrl.toString(),developmentLocalReceipts:true,
    developmentMfaToken:randomBytes(32).toString('hex'),developmentMfaUntil:later}).prepare();
  const demo=(await db.query("SELECT ends_at,ticket_price_minor,total_tickets FROM sorteos.raffles WHERE slug='demo-prueba-completa'")).rows[0];
  assert.equal(demo.ends_at.toISOString(),later);assert.equal(Number(demo.ticket_price_minor),10000);assert.equal(demo.total_tickets,100);
  try{
    const options={token:jwt,api:devBase};
    const session=await request('session',options);assert.equal(session.status,200);
    const data=await session.json() as unknown as {mfaRequired:boolean;mfaVerifiedUntil:null;developmentAccessUntil:string};
    assert.equal(data.mfaRequired,false);assert.equal(data.mfaVerifiedUntil,null);assert.equal(data.developmentAccessUntil,until);
    assert.equal((await request('orders',options)).status,200);
    assert.equal((await request('orders',{token:jwt})).status,403);
    assert.equal((await request('orders',{token:jwt,api:badBase})).status,403);
    assert.equal((await request('orders',{token:await token(staffSubject,{aal:'aal1',mfaAt:0}),api:devBase})).status,403);
    const c=await order();
    assert.equal((await request(`orders/${c.id}`,options)).status,200);
    assert.equal((await request(`payment-reports/${c.reportId}/receipt`,options)).status,200);
    const key=randomUUID(),body=approval(c);
    assert.equal((await action(c,'approve',body,{...options,key})).status,200);
    assert.equal((await action(c,'approve',body,{...options,key})).status,200);
    assert.deepEqual(await counts(c),{available:7,reserved:0,sold:3});
    const cancelled=await order();assert.equal((await action(cancelled,'cancel',cancellation(),options)).status,200);
    assert.deepEqual(await counts(cancelled),{available:10,reserved:0,sold:0});
    await assert.rejects(()=>app.get(DatabaseService).transaction(c=>c.query('SELECT * FROM sorteos.development_admin_access')));
    assert.ok((await db.query("SELECT count(*)::int AS n FROM sorteos.audit_logs WHERE action='DEVELOPMENT_MFA_ACCESS'")).rows[0].n>0);
    assert.ok(!JSON.stringify((await db.query('SELECT * FROM sorteos.audit_logs')).rows).includes(capability));
    await db.query('DELETE FROM auth.sessions WHERE id=$1',[sid]);assert.equal((await request('orders',options)).status,401);
    const another=await token(ownerSubject,{aal:'aal1',mfaAt:0});
    await db.query("UPDATE sorteos.development_admin_access SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1",[createHash('sha256').update(capability).digest('hex')]);
    assert.equal((await request('orders',{token:another,api:devBase})).status,403);
  }finally{await dev.close();await bad.close();}
});

test('sin JWT, fuera de allowlist, AAL1, MFA vencido/futuro o sesión de otro usuario no hay acceso financiero',async()=>{
  assert.equal((await request('orders',{token:null})).status,401);
  assert.equal((await request('orders',{token:await token(outsider)})).status,403);
  for(const options of [{aal:'aal1'},{mfaAt:Math.floor(Date.now()/1000)-901},{mfaAt:Math.floor(Date.now()/1000)+60}]){
    const res=await request('orders',{token:await token(ownerSubject,options)});assert.equal(res.status,403);assert.equal((await res.json()).error.code,'MFA_REQUIRED');
  }
  assert.equal((await request('orders',{token:await token(ownerSubject,{dbUser:outsider})})).status,401);
});
test('revocar sesión, vencer plazo o retirar factor impide uso de JWT todavía firmado y vigente',async()=>{
  for(const mode of ['delete','expiry','factor']) {
    const jwt=await token(),payload=JSON.parse(Buffer.from(jwt.split('.')[1]!,'base64url').toString()) as {session_id:string};
    if(mode==='delete')await db.query('DELETE FROM auth.sessions WHERE id=$1',[payload.session_id]);
    if(mode==='expiry')await db.query("UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=$1",[payload.session_id]);
    if(mode==='factor')await db.query("UPDATE auth.mfa_factors SET status='unverified' WHERE id=(SELECT factor_id FROM auth.sessions WHERE id=$1)",[payload.session_id]);
    const res=await request('orders',{token:jwt});assert.equal(res.status,401);assert.equal((await res.json()).error.code,'SESSION_REVOKED');
  }
});
test('bandeja filtrada/paginada no devuelve PII; detalle privado incluye historial y señales de duplicación',async()=>{
  const c=await order(),other=await order();
  const list=await request(`orders?raffleId=${c.raffle}&status=PENDING_REVIEW&pageSize=1`);assert.equal(list.status,200);const body=await list.json();
  assert.equal(body.pagination.total,1);assert.equal(body.items[0]!.id,c.id);assert.ok(!JSON.stringify(body).includes('b5-demo@example.invalid'));
  assert.equal((await request('orders?page=0')).status,400);assert.equal((await request('orders?from=2026-11-05T00:00:00Z&to=2026-11-01T00:00:00Z')).status,422);
  const detail=await (await request(`orders/${c.id}`,{token:staffToken})).json();assert.equal(detail.customer.email,'b5-demo@example.invalid');assert.equal(detail.ticketNumbers.length,3);
  assert.ok(detail.duplicateReceiptCount>=1);assert.ok(!JSON.stringify(detail).includes('pending/'));assert.notEqual(other.id,c.id);
});
test('ADMIN puede iniciar revisión y requerir resolución; no puede aprobar ni cancelar',async()=>{
  const c=await order();
  assert.equal((await action(c,'approve',approval(c),{token:staffToken})).status,403);
  assert.equal((await action(c,'cancel',cancellation(),{token:staffToken})).status,403);
  const started=await action(c,'start-review',{}, {token:staffToken});assert.equal(started.status,200);c.version=(await started.json()).version;
  const review=await action(c,'request-resolution',{reason:'Comprobante DEMO requiere conciliación adicional.',reportStatus:'INVALID'},{token:staffToken});assert.equal(review.status,200);
  assert.equal((await review.json()).status,'NEEDS_RESOLUTION');assert.deepEqual(await counts(c),{available:7,reserved:3,sold:0});
  await app.get(CheckoutService).sweep();assert.deepEqual(await counts(c),{available:7,reserved:3,sold:0});
  assert.equal((await db.query('SELECT status FROM sorteos.payment_reports WHERE id=$1',[c.reportId])).rows[0].status,'INVALID');
});
test('aprobar exige afirmación bancaria, importe exacto, fecha y revisión de alertas; archivo no aprueba solo',async()=>{
  const c=await order();
  assert.equal((await action(c,'approve',{...approval(c),bankVerified:false})).status,400);
  assert.equal((await action(c,'approve',{...approval(c),verifiedAmountMinor:c.total-1})).status,422);
  assert.equal((await action(c,'approve',{...approval(c),bankPostedAt:'2099-01-01T00:00:00Z'})).status,422);
  const duplicate=await action(c,'approve',{...approval(c),duplicateSignalsReviewed:false});assert.equal(duplicate.status,422);assert.equal((await duplicate.json()).error.code,'DUPLICATE_REVIEW_REQUIRED');
  assert.deepEqual(await counts(c),{available:7,reserved:3,sold:0});
});
test('aprobar convierte TODOS los RESERVED en SOLD; retry y dos instancias conservan una única acción',async()=>{
  const c=await order(),key=randomUUID(),body=approval(c);
  const responses=await Promise.all([action(c,'approve',body,{key}),action(c,'approve',body,{key,api:peerBase})]);for(const res of responses)assert.equal(res.status,200);
  const first=await responses[0]!.json();assert.deepEqual(await responses[1]!.json(),first);assert.equal(first.soldTicketCount,3);assert.equal(first.status,'PAID');
  assert.deepEqual(await counts(c),{available:7,reserved:0,sold:3});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.admin_actions WHERE order_id=$1',[c.id])).rows[0].n,1);
  assert.equal((await action(c,'approve',{...body,note:'Otro contenido de la misma clave debe fallar.'},{key})).status,409);
  assert.equal((await action({...c,version:first.version},'cancel',cancellation())).status,409);
});
test('optimismo de versión evita sobrescribir revisiones y carrera aprobar/cancelar tiene un único resultado',async()=>{
  const c=await order(),started=await (await action(c,'start-review',{})).json();
  assert.equal((await action(c,'approve',approval(c))).status,409);c.version=started.version;
  const responses=await Promise.all([action(c,'approve',approval(c)),action(c,'cancel',cancellation(),{api:peerBase})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);const state=await counts(c);assert.ok((state.sold===3&&state.available===7)||(state.sold===0&&state.available===10));assert.equal(state.reserved,0);
});
test('NEEDS_RESOLUTION puede reabrirse y aprobarse; resuelve incidencias sin cambiar números',async()=>{
  const c=await order(),original=(await db.query('SELECT id FROM sorteos.tickets WHERE current_order_id=$1 ORDER BY id',[c.id])).rows;
  c.version=(await (await action(c,'request-resolution',{reason:'Revisar referencia DEMO antes de conciliar.',reportStatus:'DISPUTED'})).json()).version;
  c.version=(await (await action(c,'start-review',{})).json()).version;
  const paid=await action(c,'approve',approval(c));assert.equal(paid.status,200);
  assert.deepEqual((await db.query('SELECT id FROM sorteos.tickets WHERE current_order_id=$1 ORDER BY id',[c.id])).rows,original);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.payment_incidents WHERE order_id=$1 AND status='RESOLVED'",[c.id])).rows[0].n,1);
});
test('cancelación exige conciliación y evidencia; libera q y conserva vínculos, reporte, staging e historial',async()=>{
  const c=await order(),payload=cancellation(),key=randomUUID();
  assert.equal((await action(c,'cancel',{...payload,reconciliationConfirmed:false})).status,400);
  assert.equal((await action(c,'cancel',{...payload,evidenceReference:''})).status,400);
  const first=await action(c,'cancel',payload,{key});assert.equal(first.status,200);const result=await first.json();assert.equal(result.releasedTicketCount,3);
  assert.deepEqual(await (await action(c,'cancel',payload,{key})).json(),result);assert.deepEqual(await counts(c),{available:10,reserved:0,sold:0});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.order_tickets WHERE order_id=$1 AND released_at IS NOT NULL',[c.id])).rows[0].n,3);
  assert.equal((await db.query('SELECT status FROM sorteos.payment_reports WHERE id=$1',[c.reportId])).rows[0].status,'INVALID');assert.ok(objects.has(c.path));
});
test('reembolso requiere importe recibido, devolución completa, fecha y referencia; no realiza transferencia bancaria',async()=>{
  const c=await order(),refund={...cancellation(),resolutionType:'REFUNDED'};
  assert.equal((await action(c,'cancel',refund)).status,422);
  const complete={...refund,receivedAmountMinor:15000,refundAmountMinor:15000,refundReference:'DEVOLUCION-DEMO',refundedAt:new Date().toISOString()};
  assert.equal((await action(c,'cancel',{...complete,refundAmountMinor:14000})).status,422);
  assert.equal((await action(c,'cancel',complete)).status,200);assert.deepEqual(await counts(c),{available:10,reserved:0,sold:0});
  const report=(await db.query('SELECT status,verified_amount_minor FROM sorteos.payment_reports WHERE id=$1',[c.reportId])).rows[0];assert.equal(report.status,'REFUNDED');assert.equal(Number(report.verified_amount_minor),15000);
});
test('duplicado conciliado exige otra orden PAID con referencia bancaria verificada del mismo banco',async()=>{
  const paid=await order(),bank=approval(paid);assert.equal((await action(paid,'approve',bank)).status,200);
  const c=await order(),payload={...cancellation(),resolutionType:'DUPLICATE_RESOLVED',duplicateOfOrderId:paid.id,duplicateBankReference:bank.bankConfirmationReference};
  assert.equal((await action(c,'cancel',{...payload,duplicateBankReference:'NO-COINCIDE'})).status,422);
  assert.equal((await action(c,'cancel',payload)).status,200);assert.deepEqual(await counts(c),{available:10,reserved:0,sold:0});assert.equal((await counts(paid)).sold,3);
});
test('fallo a mitad de aprobación revierte reporte, orden y boletos; no expone diagnóstico ni crea acción',async()=>{
  const c=await order();
  await db.query(`CREATE FUNCTION sorteos.test_financial_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIVATE_FINANCIAL_ERROR' USING ERRCODE='23514'; END $$;
    CREATE TRIGGER test_failure AFTER UPDATE ON sorteos.tickets FOR EACH ROW WHEN(NEW.status='SOLD') EXECUTE FUNCTION sorteos.test_financial_failure()`);
  try{const res=await action(c,'approve',approval(c));assert.equal(res.status,422);assert.ok(!JSON.stringify(await res.json()).includes('PRIVATE_FINANCIAL_ERROR'));}
  finally{await db.query('DROP TRIGGER test_failure ON sorteos.tickets;DROP FUNCTION sorteos.test_financial_failure()');}
  assert.equal((await db.query('SELECT status,version FROM sorteos.orders WHERE id=$1',[c.id])).rows[0].status,'PENDING_REVIEW');assert.deepEqual(await counts(c),{available:7,reserved:3,sold:0});
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.admin_actions WHERE order_id=$1',[c.id])).rows[0].n,0);
});
test('comprobante usa proxy autenticado, no URL pública, con auditoría y descarga sin caché',async()=>{
  const c=await order(),descriptor=await request(`payment-reports/${c.reportId}/receipt-url`);assert.equal(descriptor.status,200);const link=await descriptor.json();assert.equal(link.access,'AUTHENTICATED_PROXY');assert.ok(!link.url.includes('storage'));
  assert.equal((await request(`payment-reports/${c.reportId}/receipt`,{token:null})).status,401);
  const file=await request(`payment-reports/${c.reportId}/receipt`,{token:staffToken});assert.equal(file.status,200);assert.equal(file.headers.get('cache-control'),'no-store');assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.match(file.headers.get('content-disposition')!,/attachment/);assert.deepEqual(Buffer.from(await file.arrayBuffer()),png);
  assert.ok((await db.query("SELECT count(*)::int AS n FROM sorteos.audit_logs WHERE action='RECEIPT_DOWNLOAD_GRANTED' AND entity_id=$1",[c.reportId])).rows[0].n>0);
});
test('bucket público se bloquea y revocación durante descarga impide entregar los bytes',async()=>{
  const c=await order(),jwt=await token(),sid=(JSON.parse(Buffer.from(jwt.split('.')[1]!,'base64url').toString()) as {session_id:string}).session_id;
  publicBucket=true;try{assert.equal((await request(`payment-reports/${c.reportId}/receipt`)).status,503);}finally{publicBucket=false;}
  onDownload=async()=>{await db.query('DELETE FROM auth.sessions WHERE id=$1',[sid]);};
  try{const res=await request(`payment-reports/${c.reportId}/receipt`,{token:jwt});assert.equal(res.status,401);assert.match(res.headers.get('content-type')!,/json/);}finally{onDownload=undefined;}
  assert.ok(downloadCount>0);
});
test('allowlist desactivada revoca lectura y mutaciones, sin depender de expiración JWT',async()=>{
  await db.query('UPDATE sorteos.admin_users SET active=false WHERE auth_user_id=$1',[staffSubject]);
  try{assert.equal((await request('orders',{token:staffToken})).status,403);}finally{await db.query('UPDATE sorteos.admin_users SET active=true WHERE auth_user_id=$1',[staffSubject]);}
});
test('ledger no se edita/borra y runtime sin contexto MFA no puede conciliar ni leer secretos Auth',async()=>{
  assert.equal((await db.query("SELECT has_schema_privilege('sorteos_runtime','auth','USAGE') AS allowed")).rows[0].allowed,false);
  assert.equal((await db.query("SELECT has_column_privilege('sorteos_runtime','auth.sessions','id','SELECT') AS allowed")).rows[0].allowed,false);
  assert.equal((await app.get(DatabaseService).transaction(c=>c.query('SELECT sorteos.admin_auth_session_valid(false) AS valid'))).rows[0].valid,false);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) acl
    WHERE p.oid='sorteos.admin_auth_session_valid(boolean)'::regprocedure AND acl.privilege_type='EXECUTE'
      AND acl.grantee NOT IN (p.proowner,'sorteos_runtime'::regrole::oid)`)).rows[0].n,0);
  await assert.rejects(()=>db.query("UPDATE sorteos.admin_actions SET action='APPROVE'"));await assert.rejects(()=>db.query('DELETE FROM sorteos.admin_actions'));
  for(const sql of ["UPDATE sorteos.orders SET status='PAID'","SELECT secret FROM auth.mfa_factors","SELECT refresh_token FROM auth.sessions","UPDATE sorteos.admin_users SET active=true"])
    await assert.rejects(()=>app.get(DatabaseService).transaction(c=>c.query(sql)));
  const logs=(await db.query('SELECT to_jsonb(a)::text AS value FROM sorteos.audit_logs a')).rows.map(r=>r.value).join('');
  assert.ok(!logs.includes('b5-demo@example.invalid'));assert.ok(!logs.includes('DO_NOT_READ'));assert.ok(!logs.includes(ownerToken));
});
test('recuperación B5 conserva datos Auth, retira solo sus políticas/permisos, repara historial y reaplica',async()=>{
  await assert.rejects(()=>revertEmptyB5(db,localDatabaseUrl(process.env.TEST_DATABASE_URL).toString()),/Rollback B5 bloqueado/);
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL),recoveryName=`${name}_recovery`;url.pathname=`/${recoveryName}`;
  await root.query(`CREATE DATABASE ${recoveryName}`);const recovery=new Client({connectionString:url.toString()});
  try{
    await recovery.connect();await authFixture(recovery);migrateLocal(url.toString());
    await recovery.query("INSERT INTO auth.mfa_factors(id,user_id,status,factor_type) VALUES($1,$2,'verified','totp')",[randomUUID(),randomUUID()]);
    await revertEmptyB5(recovery,url.toString());
    assert.equal((await recovery.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos'")).rows[0].n,15);
    assert.equal((await recovery.query('SELECT count(*)::int AS n FROM auth.mfa_factors')).rows[0].n,1);
    assert.equal((await recovery.query("SELECT has_column_privilege('sorteos_runtime','auth.sessions','id','SELECT') AS allowed")).rows[0].allowed,false);
    migrateLocal(url.toString());assert.equal((await recovery.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos'")).rows[0].n,25);
  }finally{await recovery.end();await root.query(`DROP DATABASE ${recoveryName} WITH(FORCE)`);}
});

test('M5 indicadores separan inventario, ingreso confirmado y pendiente; lectura privada auditada',async()=>{
  const c=await order(2);
  const result=await request(`raffles/${c.raffle}/summary`);assert.equal(result.status,200);
  const first=await result.json() as unknown as OperationSummaryDto;
  assert.deepEqual([first.total,first.available,first.held,first.reserved,first.sold],[10,8,0,2,0]);
  assert.equal(first.confirmedAmountMinor,'0');assert.equal(first.pendingAmountMinor,String(c.total));assert.equal(first.pendingOrders,1);
  assert.equal((await action(c,'request-resolution',{reason:'Conciliación pendiente en pruebas M5.',reportStatus:'DISPUTED'})).status,200);
  const disputed=await (await request(`raffles/${c.raffle}/summary`)).json() as unknown as OperationSummaryDto;
  assert.equal(disputed.openIncidents,1);assert.equal(disputed.reserved,2);assert.equal(disputed.confirmedAmountMinor,'0');
  const current=(await db.query('SELECT version FROM sorteos.orders WHERE id=$1',[c.id])).rows[0];
  assert.equal((await action({...c,version:current.version},'approve',approval(c))).status,200);
  const paid=await (await request(`raffles/${c.raffle}/summary`)).json() as unknown as OperationSummaryDto;
  assert.equal(paid.confirmedAmountMinor,String(c.total));assert.equal(paid.pendingAmountMinor,'0');assert.equal(paid.sold,2);assert.equal(paid.reserved,0);assert.equal(paid.openIncidents,0);
  assert.equal((await request('dashboard',{token:null})).status,401);
  assert.equal((await request('dashboard',{token:await token(ownerSubject,{aal:'aal1'})})).status,403);
  assert.equal((await request('dashboard',{token:staffToken})).status,200);
  assert.ok((await db.query("SELECT 1 FROM sorteos.audit_logs WHERE action='OPERATIONS_SUMMARY_READ' AND entity_id=$1",[c.raffle])).rowCount);
});

test('M5 cierre exige pausa, versión actual y cero holds; conserva reservas y permite conciliación posterior',async()=>{
  const c=await order(2);
  const getVersion=async()=>Number((await db.query('SELECT version FROM sorteos.raffles WHERE id=$1',[c.raffle])).rows[0].version);
  const close=async(version?:number)=>request(`raffles/${c.raffle}/close`,{method:'POST',body:{expectedVersion:version??await getVersion()}});
  assert.equal((await close()).status,409);
  const hold=await fetch(base+'/api/v1/checkout-holds',{method:'POST',headers:{Origin:origin,Cookie:c.cookie,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({raffleId:c.raffle,quantity:1})});assert.equal(hold.status,201);const holdId=(await hold.json()).holdId;
  assert.equal((await request(`raffles/${c.raffle}/pause`,{method:'POST',body:{}})).status,200);
  const blocked=await close();assert.equal(blocked.status,409);assert.equal((await blocked.json()).error.code,'ACTIVE_HOLDS_EXIST');
  await assert.rejects(()=>db.query("UPDATE sorteos.raffles SET status='CLOSED' WHERE id=$1",[c.raffle]));
  assert.equal((await fetch(base+`/api/v1/checkout-holds/${holdId}`,{method:'DELETE',headers:{Origin:origin,Cookie:c.cookie}})).status,200);
  assert.equal((await close(1)).status,409);
  const version=await getVersion();assert.equal((await request(`raffles/${c.raffle}/close`,{method:'POST',body:{expectedVersion:version},token:staffToken})).status,403);
  const staff=(await db.query('SELECT id FROM sorteos.admin_users WHERE auth_user_id=$1',[staffSubject])).rows[0];
  const claims=(await jwtVerify(staffToken,keys.publicKey)).payload;
  await assert.rejects(()=>app.get(DatabaseService).transaction(async client=>{
    await app.get(FinancialAuthorization).authorize(client,{id:staff.id,authUserId:staffSubject,role:'ADMIN'},{sessionId:String(claims.session_id),aal:'aal2',mfaAt:Number(claims.iat)},randomUUID());
    await client.query("UPDATE sorteos.raffles SET status='CLOSED' WHERE id=$1",[c.raffle]);
  }),error=>String((error as {code:string}).code)==='P0501');
  assert.equal((await close(version)).status,200);assert.deepEqual(await counts(c),{available:8,reserved:2,sold:0});
  assert.equal((await fetch(base+'/api/v1/orders/'+c.orderCode,{headers:{Cookie:c.cookie}})).status,200);
  const rejected=await fetch(base+'/api/v1/checkout-holds',{method:'POST',headers:{Origin:origin,Cookie:c.cookie,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({raffleId:c.raffle,quantity:1})});assert.equal(rejected.status,409);
  await assert.rejects(()=>db.query("UPDATE sorteos.raffles SET status='PAUSED' WHERE id=$1",[c.raffle]));
  await assert.rejects(()=>db.query("UPDATE sorteos.raffles SET status='DRAWN' WHERE id=$1",[c.raffle]));
  assert.equal((await action(c,'approve',approval(c))).status,200);assert.deepEqual(await counts(c),{available:8,reserved:0,sold:2});
});

test('M5 CSV requiere OWNER/MFA, respeta filtros, minimiza datos y audita exportación',async()=>{
  const c=await order(1),path=`reports/orders.csv?raffleId=${c.raffle}&status=PENDING_REVIEW`;
  assert.equal((await request(path,{token:null})).status,401);assert.equal((await request(path,{token:staffToken})).status,403);
  assert.equal((await request(path,{token:await token(ownerSubject,{aal:'aal1'})})).status,403);
  const response=await request(path);assert.equal(response.status,200);assert.match(response.headers.get('content-type')! ,/text\/csv/);assert.match(response.headers.get('cache-control')!,/no-store/);
  const csv=await response.text();assert.ok(csv.includes(c.orderCode));assert.ok(csv.includes(String(c.total)));assert.equal(csv.trim().split('\r\n').length,2);
  for(const privateValue of ['CLIENTE DEMO','5550100','example.invalid',c.reference,'pending/','ticketNumbers',ownerToken])assert.ok(!csv.includes(privateValue));
  assert.equal((await request('reports/orders.csv?from=2026-11-06T00:00:00Z&to=2026-11-05T00:00:00Z')).status,422);
  assert.ok((await db.query("SELECT 1 FROM sorteos.audit_logs WHERE action='ORDERS_CSV_EXPORTED' AND entity_id=$1 AND metadata->>'count'='1'",[c.raffle])).rowCount);
  for(const unsafe of ['=1+1',' +SUM(A1:A2)','-1','@SUM(1)','\t=2','\r=2'])assert.ok(csvCell(unsafe).startsWith('"\''));
  assert.equal(csvCell('a,"b"'),'"a,""b"""');
});

test('M5 edición con versión obsoleta no sobrescribe borrador',async()=>{
  const c=await order(1);await request(`raffles/${c.raffle}/pause`,{method:'POST',body:{}});
  const version=Number((await db.query('SELECT version FROM sorteos.raffles WHERE id=$1',[c.raffle])).rows[0].version);
  assert.equal((await request(`raffles/${c.raffle}`,{method:'PATCH',body:{title:'Título M5 vigente',expectedVersion:version}})).status,200);
  const stale=await request(`raffles/${c.raffle}`,{method:'PATCH',body:{title:'Título obsoleto',expectedVersion:version}});assert.equal(stale.status,409);
  assert.equal((await db.query('SELECT title FROM sorteos.raffles WHERE id=$1',[c.raffle])).rows[0].title,'Título M5 vigente');
});

test('objetivo cambia tras cierre sin reabrir y dos versiones concurrentes no se sobrescriben',async()=>{
  const c=await order(1);
  assert.equal((await request(`raffles/${c.raffle}/pause`,{method:'POST',body:{}})).status,200);
  let version=(await db.query('SELECT version FROM sorteos.raffles WHERE id=$1',[c.raffle])).rows[0].version;
  assert.equal((await request(`raffles/${c.raffle}/close`,{method:'POST',body:{expectedVersion:version}})).status,200);
  version=(await db.query('SELECT version FROM sorteos.raffles WHERE id=$1',[c.raffle])).rows[0].version;
  const path=`raffles/${c.raffle}/fundraising-target`,body={fundraisingTargetMinor:100000,expectedVersion:version,reason:'Objetivo DEMO después del cierre'};
  assert.equal((await request(path,{method:'POST',body,key:randomUUID(),token:staffToken})).status,403);
  const responses=await Promise.all([request(path,{method:'POST',body,key:randomUUID()}),request(path,{method:'POST',body:{...body,fundraisingTargetMinor:200000},key:randomUUID(),api:peerBase})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
  const row=(await db.query('SELECT status,total_tickets,ticket_price_minor,version FROM sorteos.raffles WHERE id=$1',[c.raffle])).rows[0];
  assert.equal(row.status,'CLOSED');assert.equal(row.total_tickets,10);assert.equal(row.ticket_price_minor,'10025');assert.equal(row.version,version+1);
});

test('M5 fotos propias normalizadas: Auth/MFA, Storage público separado, formato real y publicación',async()=>{
  async function upload(bytes:Buffer,mime='image/png',auth:string|null=ownerToken){
    const form=new FormData();form.set('image',new Blob([new Uint8Array(bytes)],{type:mime}),'prueba.png');
    return fetch(base+'/api/v1/admin/media',{method:'POST',headers:auth?{Authorization:'Bearer '+auth}:{},body:form});
  }
  assert.equal((await upload(png,'image/png',null)).status,401);
  assert.equal((await upload(png,'image/png',await token(ownerSubject,{aal:'aal1'}))).status,403);
  assert.equal((await upload(Buffer.from('<svg><script/></svg>'),'image/png')).status,422);
  publicPrizeBucket=false;try{assert.equal((await upload(png)).status,503);}finally{publicPrizeBucket=true;}
  const response=await upload(png);assert.equal(response.status,201);
  const media=await response.json() as unknown as {storageKey:string;url:string};assert.match(media.storageKey,/^prizes\/[a-f0-9-]{36}\.webp$/);
  assert.equal((await sharp(objects.get('media:'+media.storageKey)!).metadata()).format,'webp');assert.ok(!media.url.includes('receipts'));
  const draft={slug:'m5-media-'+randomUUID(),title:'PREMIO DEMO',description:'Prueba sin valor real',prize:'PREMIO DE PRUEBA',totalTickets:100000,fundraisingTargetMinor:1000000,ticketPriceMinor:10000,minPurchase:1,maxPurchase:5,rules:'NO TRANSFERIR: DEMO',rulesVersion:'M5',images:[{storageKey:media.storageKey,alt:'Foto propia de prueba',rightsConfirmed:true}]};
  const created=await request('raffles',{method:'POST',body:draft});assert.equal(created.status,201);const id=(await created.json()).id;
  assert.equal((await request(`raffles/${id}/publish`,{method:'POST',body:{rulesApproved:true,requirementsReviewed:true,mediaRightsConfirmed:true}})).status,200);
  assert.throws(()=>parseConfig({NODE_ENV:'production',DEVELOPMENT_LOCAL_MEDIA:'true'}),/Fotos locales/);
});

test('etapa 4: Pick4 + FIREBALL, premio, resultado, adjudicación, entrega e idempotencia con runtime real',async()=>{
 let prizeId='';
 const c=await order(1,async raffle=>{
  const created=await request(`raffles/${raffle}/lottery`,{method:'POST',key:randomUUID(),body:{action:'PRIZE',title:'PREMIO DEMO LOTERIA'}});
  assert.equal(created.status,200,JSON.stringify(await created.clone().json()));prizeId=String((await created.json()).id);
 });
 const route=`raffles/${c.raffle}/lottery`;
 assert.equal((await request(route+'/results',{token:null})).status,401);
 assert.equal((await request(route,{method:'POST',key:randomUUID(),token:staffToken,body:{action:'RESULT',pick4:'0000',fireball:'0',eventAt:new Date().toISOString(),reference:'DEMO'}})).status,403);
 const n=Number((await db.query('SELECT number FROM sorteos.tickets WHERE current_order_id=$1',[c.id])).rows[0].number);
 const body={action:'RESULT',pick4:'0000',fireball:String(n),eventAt:new Date().toISOString(),reference:'EDICION DEMO - NO RESULTADO REAL'};
 const preliminary=await request(route,{method:'POST',key:randomUUID(),body});assert.equal(preliminary.status,200);
 const preliminaryId=String((await preliminary.json()).id);
 assert.equal((await request(route,{method:'POST',key:randomUUID(),body:{action:'AWARD',resultId:preliminaryId,prizeId}})).status,409);
 assert.equal((await action(c,'approve',approval(c))).status,200);
 assert.equal((await request(`raffles/${c.raffle}/pause`,{method:'POST',body:{}})).status,200);
 const version=(await db.query('SELECT version FROM sorteos.raffles WHERE id=$1',[c.raffle])).rows[0].version;
 assert.equal((await request(`raffles/${c.raffle}/close`,{method:'POST',body:{expectedVersion:version}})).status,200);
 const unsold=await request(route,{method:'POST',key:randomUUID(),body:{...body,fireball:String((n+1)%10),eventAt:new Date().toISOString()}});
 assert.equal(unsold.status,200);const unsoldId=String((await unsold.json()).id);
 assert.equal((await request(route,{method:'POST',key:randomUUID(),body:{action:'AWARD',resultId:unsoldId,prizeId}})).status,409);
 const key=randomUUID(),finalBody={...body,eventAt:new Date().toISOString()};
 const result=await request(route,{method:'POST',key,body:finalBody});assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
 const resultId=String((await result.json()).id);
 assert.equal(String((await (await request(route,{method:'POST',key,api:peerBase,body:finalBody})).json()).id),resultId);
 const rows=(await (await request(route+'/results')).json()) as unknown as {items:{number:string;status:string}[]};
 assert.ok(rows.items.some(r=>r.number===String(n).padStart(5,'0')&&r.status==='ELIGIBLE'));
 const awardBody={action:'AWARD',resultId,prizeId},awardKey=randomUUID();
 const award=await request(route,{method:'POST',key:awardKey,body:awardBody});assert.equal(award.status,200,JSON.stringify(await award.clone().json()));
 const awardId=String((await award.json()).id);
 assert.equal(String((await (await request(route,{method:'POST',key:awardKey,body:awardBody})).json()).id),awardId);
 const delivery={action:'DELIVERY',source:'LOTTERY',awardId,eventAt:new Date().toISOString(),reference:'CONSTANCIA DEMO SIN ENTREGA REAL'};
 const deliveryKey=randomUUID(),delivered=await request(route,{method:'POST',key:deliveryKey,body:delivery});assert.equal(delivered.status,200,JSON.stringify(await delivered.clone().json()));
 assert.equal((await request(route,{method:'POST',key:deliveryKey,body:delivery})).status,200);
 assert.equal((await request(route,{method:'POST',key:randomUUID(),body:delivery})).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM sorteos.prize_deliveries WHERE lottery_award_id=$1',[awardId])).rows[0].n,1);
 await assert.rejects(()=>db.query('UPDATE sorteos.lottery_results SET reference=reference WHERE id=$1',[resultId]));
 await assert.rejects(()=>db.query('DELETE FROM sorteos.prize_deliveries WHERE lottery_award_id=$1',[awardId]));
 const history=await request(route+'/deliveries');assert.equal(history.status,200);assert.match(JSON.stringify(await history.json()),/DELIVERED/);
});

test('etapa 4: entrega bendecida exige confirmación del pago y conserva un único histórico',async()=>{
 const c=await order(1,async raffle=>{
  let version=Number((await db.query('SELECT version FROM sorteos.raffles WHERE id=$1',[raffle])).rows[0].version);
  const prize=await request(`raffles/${raffle}/prizes`,{method:'POST',key:randomUUID(),body:{title:'PREMIO BENDECIDO DEMO',description:'Sin entrega real',kind:'ITEM',quantity:10,expectedVersion:version}});
  assert.equal(prize.status,200,JSON.stringify(await prize.clone().json()));const data=await prize.json() as unknown as {prizeId:string;version:number};version=data.version;
  const assigned=await request(`raffles/${raffle}/blessed-numbers`,{method:'POST',key:randomUUID(),body:{prizeId:data.prizeId,mode:'MANUAL',numbers:Array.from({length:10},(_,n)=>String(n).padStart(5,'0')),expectedVersion:version}});
  assert.equal(assigned.status,200,JSON.stringify(await assigned.clone().json()));
 });
 const award=(await db.query('SELECT id,status FROM sorteos.blessed_awards WHERE order_id=$1',[c.id])).rows[0];assert.equal(award.status,'PENDING_PAYMENT');
 const route=`raffles/${c.raffle}/lottery`,body={action:'DELIVERY',source:'BLESSED',awardId:award.id,eventAt:new Date().toISOString(),reference:'CONSTANCIA BENDECIDA DEMO'};
 assert.equal((await request(route,{method:'POST',key:randomUUID(),body})).status,409);
 assert.equal((await action(c,'approve',approval(c))).status,200);
 const delivered={...body,eventAt:new Date().toISOString()},key=randomUUID();
 const result=await request(route,{method:'POST',key,body:delivered});assert.equal(result.status,200,JSON.stringify(await result.clone().json()));
 assert.equal((await request(route,{method:'POST',key,body:delivered,api:peerBase})).status,200);
 assert.equal((await db.query('SELECT count(*)::int n FROM sorteos.prize_deliveries WHERE blessed_award_id=$1',[award.id])).rows[0].n,1);
});


test('etapa 5: resumen censurado por teléfono, aislamiento, cancelación y límites entre instancias',async()=>{
  const fixture=await order(2),other=await order(1);
  const search=async(phone='+18095550100',raffleId=fixture.raffle,options:{origin?:string;api?:string;extra?:Record<string,unknown>}={})=>
    globalThis.fetch((options.api??base)+'/api/v1/ticket-lookup/search',{method:'POST',headers:{Origin:options.origin??origin,'Content-Type':'application/json'},
      body:JSON.stringify({raffleId,phone,...options.extra})});
  const first=await search('809 555-0100');assert.equal(first.status,200);
  assert.equal(first.headers.get('cache-control'),'no-store');
  const body=await first.json() as TicketLookupResultDto;
  assert.deepEqual(body,{items:[{maskedName:maskHalf('CLIENTE DEMO B5'),maskedEmail:maskLookupEmail('b5-demo@example.invalid'),ticketCount:2,orderStatus:'PENDING_REVIEW'}],total:1,totalTickets:2});
  const text=JSON.stringify(body);
  for(const secret of ['CLIENTE DEMO B5','b5-demo@example.invalid',fixture.orderCode,fixture.path,'+18095550100','ticketNumbers','orderCode','receipt'])assert.equal(text.includes(secret),false);
  assert.equal((await search('+18095550101')).status,200);
  assert.deepEqual(await (await search('+18095550101')).json(),{items:[],total:0,totalTickets:0});
  assert.equal((await search('+18095550100',other.raffle)).status,200);
  assert.deepEqual(await (await search('+18095550100',randomUUID())).json(),{items:[],total:0,totalTickets:0});
  assert.equal((await search('12345')).status,400);
  assert.equal((await search(undefined,undefined,{origin:'https://outside.invalid'})).status,403);
  assert.equal((await search(undefined,undefined,{extra:{includeTickets:true}})).status,400);
  assert.equal((await globalThis.fetch(base+'/api/v1/orders/'+fixture.orderCode)).status,401);
  // A second real order for the same recorded contact must preserve each order and its state.
  const againHold=await globalThis.fetch(base+'/api/v1/checkout-holds',{method:'POST',headers:{Origin:origin,Cookie:fixture.cookie,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({raffleId:fixture.raffle,quantity:1})});
  assert.equal(againHold.status,201);const againHoldId=(await againHold.json() as {holdId:string}).holdId;
  const form=new FormData();
  for(const [key,value]of Object.entries({holdId:againHoldId,customerName:'CLIENTE DEMO B5',customerPhone:'+18095550100',customerEmail:'b5-demo@example.invalid',bankAccountId:bankId,bankReference:'DEMO MULTIPLE ORDERS',transferDate:new Date().toISOString(),acceptedRulesVersion:'B5-1'}))form.append(key,value);
  form.append('receipt',new Blob([new Uint8Array(png)],{type:'image/png'}),'fixture.png');
  assert.equal((await globalThis.fetch(base+'/api/v1/orders',{method:'POST',headers:{Origin:origin,Cookie:fixture.cookie,'Idempotency-Key':randomUUID()},body:form})).status,201);
  const multiple=await (await search()).json() as TicketLookupResultDto;
  assert.equal(multiple.total,2);assert.equal(multiple.totalTickets,3);assert.deepEqual(multiple.items.map(row=>row.ticketCount).sort(),[1,2]);
  assert.ok(multiple.items.every(row=>row.orderStatus==='PENDING_REVIEW'));
  const started=await action(fixture,'start-review',{});assert.equal(started.status,200);fixture.version=(await started.json()).version;
  assert.deepEqual((await (await search()).json() as TicketLookupResultDto).items.map(row=>row.orderStatus).sort(),['PENDING_REVIEW','UNDER_REVIEW']);
  const resolution=await action(fixture,'request-resolution',{reason:'Conciliación DEMO pendiente.',reportStatus:'INVALID'});
  assert.equal(resolution.status,200);fixture.version=(await resolution.json()).version;
  assert.deepEqual((await (await search()).json() as TicketLookupResultDto).items.map(row=>row.orderStatus).sort(),['NEEDS_RESOLUTION','PENDING_REVIEW']);
  assert.equal((await action(fixture,'cancel',cancellation())).status,200);
  const remaining=await (await search()).json() as TicketLookupResultDto;
  assert.equal(remaining.totalTickets,1);assert.equal(remaining.items[0]!.ticketCount,1);
  assert.equal((await action(other,'approve',approval(other))).status,200);
  assert.equal((await (await search(undefined,other.raffle)).json() as TicketLookupResultDto).items[0]!.orderStatus,'PAID');
  const counters=await db.query('SELECT key FROM sorteos.ticket_lookup_limits');
  assert.ok(counters.rows.every(row=>/^(ip|phone):[a-f0-9]{64}$/.test(row.key)));
  const audit=await db.query("SELECT * FROM sorteos.audit_logs WHERE action='PUBLIC_TICKET_SUMMARY'");assert.ok(audit.rowCount!>0);
  assert.equal(JSON.stringify(audit.rows).includes('5550100'),false);
  await db.query('TRUNCATE sorteos.ticket_lookup_limits');
  const responses=await Promise.all(Array.from({length:24},(_,i)=>search(undefined,other.raffle,{api:i%2?base:peerBase})));
  assert.equal(responses.filter(r=>r.status===200).length,20);
  assert.equal(responses.filter(r=>r.status===429).length,4);
  const stillLimited=await search(undefined,other.raffle);assert.equal(stillLimited.status,429);
  const schema=(await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='sorteos.ticket_lookup_limits'::regclass")).rows[0];assert.equal(schema.relrowsecurity,true);
});
