import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { createApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { localDatabaseUrl, migrateLocal, revertLocalMigrationHistory, workspaceRoot } from '../src/database/local-tools';
import { seedDemo } from '../src/database/seed-demo';
import { CheckoutService } from '../src/checkout/checkout.service';
import { HoldDto } from '../src/checkout/checkout.dto';
import { revertEmptyB4 } from './recovery-tools';

// Tipado del JSON esperado; las aserciones HTTP y de campos verifican el contrato real.
async function fetch(...args:Parameters<typeof globalThis.fetch>) {
  return await globalThis.fetch(...args) as Omit<Response,'json'> & {json():Promise<HoldDto & {error:{code:string}}>};
}

const name=`sorteos_b1_test_b3_${process.pid}`;
const login=`sorteos_b3_login_${process.pid}`;
const password=randomUUID();
const origin='http://localhost:3000';
let root:Client,db:Client,app:INestApplication,base:string,runtimeUrl:string;
let peer:INestApplication,peerBase:string;
let rootConnected=false,created=false,loginCreated=false;
const settings={NODE_ENV:'test',LOG_LEVEL:'silent',SWAGGER_ENABLED:'false',DATABASE_SSL:'false',
  HTTP_RATE_STORE:'postgres',
  HOLD_MAX_ACTIVE_IP:'1000',HOLD_HOURLY_IP:'10000',CHECKOUT_SESSION_HOURLY_IP:'10000',RATE_LIMIT:'10000',
  HOLD_SWEEP_MS:'3600000',CHECKOUT_ABUSE_HASH_KEY:'b3-integration-key-'.repeat(3)};
before(async()=>{
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL);
  root=new Client({connectionString:url.toString()});await root.connect();rootConnected=true;
  await root.query(`CREATE DATABASE ${name}`);created=true;
  url.pathname=`/${name}`;migrateLocal(url.toString());
  db=new Client({connectionString:url.toString()});await db.connect();await seedDemo(db);
  await db.query("UPDATE sorteos.admin_users SET active=true WHERE role='OWNER'");
  await root.query(`CREATE ROLE ${login} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);loginCreated=true;
  await root.query(`GRANT sorteos_runtime TO ${login}`);
  url.username=login;url.password=password;runtimeUrl=url.toString();
  app=await createApp(parseConfig({...settings,DATABASE_URL:runtimeUrl}));await app.listen(0,'127.0.0.1');base=await app.getUrl();
  peer=await createApp(parseConfig({...settings,DATABASE_URL:runtimeUrl}));await peer.listen(0,'127.0.0.1');peerBase=await peer.getUrl();
});
after(async()=>{
  await app?.close();await peer?.close();await db?.end();
  if(rootConnected){if(created)await root.query(`DROP DATABASE ${name} WITH(FORCE)`);if(loginCreated)await root.query(`DROP ROLE ${login}`);await root.end();}
});
async function raffle(n=20,status='PUBLISHED',startsAt:string|null=null,endsAt:string|null=null) {
  const id=randomUUID();
  await db.query(`INSERT INTO sorteos.raffles(inventory_policy,id,slug,title,description,prize,total_tickets,ticket_price_minor,min_purchase,max_purchase,rules,rules_version,starts_at,ends_at) VALUES ('LEGACY',$1,$2,'DEMO B3','SOLO TEST','SIN PREMIO REAL',$3,10025,1,$3,'NO TRANSFERIR','TEST-1',$4,$5)`,[id,`demo-${id}`,n,startsAt,endsAt]);
  if(status==='PUBLISHED') {
    await db.query("INSERT INTO sorteos.raffle_media(raffle_id,storage_key,alt,position,rights_confirmed) VALUES($1,'prizes/test.webp','Solo fixture',0,true)",[id]);
    await db.query(`UPDATE sorteos.raffles SET status='PUBLISHED',publication_approved_at=now(),approved_rules_version=rules_version,
      publication_approved_by=(SELECT id FROM sorteos.admin_users WHERE role='OWNER') WHERE id=$1`,[id]);
  }
  return id;
}
async function session(api=base) {
  const res=await fetch(`${api}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin}});
  assert.equal(res.status,201);assert.deepEqual(await res.json(),{ready:true});
  const cookie=res.headers.get('set-cookie')!;
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Path=\//);
  return cookie.split(';')[0]!;
}
function create(id:string,cookie:string,key:string=randomUUID(),quantity=1,api=base) {
  return fetch(`${api}/api/v1/checkout-holds`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Idempotency-Key':key,'Content-Type':'application/json'},body:JSON.stringify({raffleId:id,quantity})});
}
function access(id:string,cookie:string,method='GET',api=base) {
  return fetch(`${api}/api/v1/checkout-holds/${id}`,{method,headers:{Origin:origin,Cookie:cookie}});
}
test('sesión secreta en cookie, hash en DB y protección de origen/CSRF',async()=>{
  const cases:Record<string,string>[]=[{},{Origin:'null'},{Origin:'https://other.invalid'},{Origin:origin,'Sec-Fetch-Site':'cross-site'}];
  for(const headers of cases) {
    assert.equal((await fetch(`${base}/api/v1/checkout-session`,{method:'POST',headers})).status,403);
  }
  const cookie=await session();
  const secret=cookie.split('=')[1]!;
  const found=await db.query('SELECT secret_hash FROM sorteos.guest_sessions WHERE secret_hash=$1',[createHash('sha256').update(secret).digest('hex')]);
  assert.equal(found.rowCount,1);assert.notEqual(found.rows[0].secret_hash,secret);
  const repeated=await fetch(`${base}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin,Cookie:cookie}});
  assert.equal(repeated.headers.get('set-cookie')!.split(';')[0],cookie);
  const id=await raffle();
  assert.equal((await create(id,'')).status,401);
  const wrong=await fetch(`${base}/api/v1/checkout-holds`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:JSON.stringify({raffleId:id,quantity:1})});
  assert.equal(wrong.status,403);
});
test('snapshot exacto, TTL 60 minutos, sin números ni orden y GET/DELETE solo de sesión propietaria',async()=>{
  const id=await raffle(),cookie=await session();
  const res=await create(id,cookie,randomUUID(),3);assert.equal(res.status,201);
  assert.equal(res.headers.get('cache-control'),'no-store');
  const hold=await res.json();
  assert.deepEqual(Object.keys(hold).sort(),['holdId','raffleId','quantity','unitPriceMinor','totalMinor','currency','expiresAt','serverTime','status'].sort());
  assert.equal(hold.totalMinor,30075);assert.equal(hold.unitPriceMinor,10025);assert.equal(hold.status,'ACTIVE');
  assert.equal(Date.parse(hold.expiresAt)-Date.parse(hold.serverTime),3600000);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.orders')).rows[0].n,1); // Solo seed previo.
  const foreign=await session();
  assert.equal((await access(hold.holdId,foreign)).status,404);
  assert.equal((await access(hold.holdId,foreign,'DELETE')).status,404);
  assert.equal((await access(hold.holdId,'sorteos_guest=invalid')).status,401);
  assert.equal((await access(hold.holdId,cookie)).status,200);
  assert.equal((await (await access(hold.holdId,cookie,'DELETE')).json()).status,'CANCELLED');
  assert.equal((await (await access(hold.holdId,cookie,'DELETE')).json()).status,'CANCELLED');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1 AND status='AVAILABLE'",[id])).rows[0].n,20);
});
test('reintentos paralelos conservan el mismo hold y payload distinto da conflicto incluso entre rifas',async()=>{
  const id=await raffle(),cookie=await session(),key=randomUUID();
  const results=await Promise.all(Array.from({length:25},()=>create(id,cookie,key,2)));
  for(const res of results)assert.equal(res.status,201);
  const bodies=await Promise.all(results.map(r=>r.json()));assert.equal(new Set(bodies.map(b=>b.holdId)).size,1);
  assert.equal((await create(id,cookie,key,3)).status,409);
  const other=await raffle();assert.equal((await create(other,cookie,key,2)).status,409);
  await access(bodies[0]!.holdId,cookie,'DELETE');
  assert.equal((await (await create(id,cookie,key,2)).json()).status,'CANCELLED');
});
test('cantidad, campos desconocidos, UUID, cabecera y ventana de venta se validan sin inventario parcial',async()=>{
  const id=await raffle(2),cookie=await session();
  assert.equal((await create(id,cookie,randomUUID(),3)).status,422);
  assert.equal((await create(id,cookie,'invalid')).status,400);
  for(const raffleId of [await raffle(5,'DRAFT'),await raffle(5,'PUBLISHED','2099-01-01T00:00:00Z'),await raffle(5,'PUBLISHED',null,'2000-01-01T00:00:00Z')]) {
    assert.equal((await create(raffleId,cookie)).status,409);
  }
  const extra=await fetch(`${base}/api/v1/checkout-holds`,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({raffleId:id,quantity:1,ticketNumbers:[0]})});
  assert.equal(extra.status,400);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.checkout_holds WHERE raffle_id=$1',[id])).rows[0].n,0);
});
test('H03 M6: 100 solicitudes paralelas y reintentos disputan los últimos 20 entre dos instancias',async()=>{
  const id=await raffle(20);
  const cookies=await Promise.all(Array.from({length:100},()=>session()));
  const keys=cookies.map(()=>randomUUID());
  const started=performance.now();
  const samples=await Promise.all(cookies.map(async(cookie,index)=>{
    const begin=performance.now();const response=await create(id,cookie,keys[index]!,1,index%2?peerBase:base);
    return {response,duration:performance.now()-begin,index};
  }));
  const responses=samples.map(sample=>sample.response);
  const elapsed=Math.round(performance.now()-started);
  assert.equal(responses.filter(r=>r.status===201).length,20);
  assert.equal(responses.filter(r=>r.status===409).length,80);
  for(const res of responses)if(res.status===409)assert.equal((await res.json()).error.code,'INSUFFICIENT_TICKETS');
  const inventory=await db.query(`SELECT count(*)::int AS total,count(DISTINCT number)::int AS distinct_numbers,
    count(*) FILTER(WHERE status='HELD')::int AS held,count(DISTINCT hold_id)::int AS holds FROM sorteos.tickets WHERE raffle_id=$1`,[id]);
  assert.deepEqual(inventory.rows[0],{total:20,distinct_numbers:20,held:20,holds:20});
  for(const sample of samples.filter(s=>s.response.status===201)){
    const original=await sample.response.json();
    const retry=await create(id,cookies[sample.index]!,keys[sample.index]!,1,sample.index%2?base:peerBase);
    assert.equal(retry.status,201);assert.equal((await retry.json()).holdId,original.holdId);
  }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.checkout_holds WHERE raffle_id=$1',[id])).rows[0].n,20);
  const sorted=samples.map(s=>s.duration).sort((a,b)=>a-b);
  const percentile=(p:number)=>Math.round(sorted[Math.ceil(sorted.length*p)-1]!);
  const report={scenario:'H03',httpRateStore:'postgres',requests:100,instances:2,accepted:20,rejected:80,unexpectedErrors:0,
    retriedAccepted:20,duplicateHolds:0,duplicateTickets:0,durationMs:elapsed,p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99)};
  const folder=resolve(workspaceRoot,'.tmp/m6');await mkdir(folder,{recursive:true});
  await writeFile(resolve(folder,'load.json'),JSON.stringify(report,null,2));console.info(JSON.stringify(report));
});
test('límites persistentes por sesión/IP, por hora y sesiones nuevas; X-Forwarded-For no evade límites',async()=>{
  const limited=await createApp(parseConfig({...settings,DATABASE_URL:runtimeUrl,HOLD_MAX_ACTIVE_IP:'1',HOLD_HOURLY_IP:'2',
    CHECKOUT_SESSION_HOURLY_IP:'2',CHECKOUT_ABUSE_HASH_KEY:'limited-fixture-'.repeat(3)}));
  await limited.listen(0,'127.0.0.1');const api=await limited.getUrl();
  try {
    const id=await raffle(),a=await session(api),b=await session(api);
    assert.equal((await fetch(`${api}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin,'X-Forwarded-For':'198.51.100.10'}})).status,429);
    const first=await (await create(id,a,randomUUID(),1,api)).json();
    assert.equal((await create(id,a,randomUUID(),1,api)).status,429);
    assert.equal((await create(id,b,randomUUID(),1,api)).status,429);
    await access(first.holdId,a,'DELETE',api);
    const second=await create(id,b,randomUUID(),1,api);assert.equal(second.status,201);
    await access((await second.json()).holdId,b,'DELETE',api);
    assert.equal((await create(id,a,randomUUID(),1,api)).status,429);
  }finally{await limited.close();}
});
async function expiredFixture(raffleId:string,cookie:string) {
  const secretHash=createHash('sha256').update(cookie.split('=')[1]!).digest('hex');
  const sessionId=(await db.query('SELECT id FROM sorteos.guest_sessions WHERE secret_hash=$1',[secretHash])).rows[0].id;
  await db.query('BEGIN');
  try {
    const h=await db.query(`INSERT INTO sorteos.checkout_holds(raffle_id,session_id,quantity,unit_price_minor_snapshot,rules_version_snapshot,
      expires_at,created_at,idempotency_key,request_hash) VALUES($1,$2,1,10025,'TEST-1',now()-interval '1 minute',now()-interval '2 hours',$3,repeat('a',64)) RETURNING id`,[raffleId,sessionId,randomUUID()]);
    await db.query("UPDATE sorteos.tickets SET status='HELD',hold_id=$1 WHERE id=(SELECT id FROM sorteos.tickets WHERE raffle_id=$2 AND status='AVAILABLE' LIMIT 1)",[h.rows[0].id,raffleId]);
    await db.query('COMMIT');return h.rows[0].id as string;
  }catch(e){await db.query('ROLLBACK');throw e;}
}
test('liberación lazy y job solo tocan HELD vencidos; nunca RESERVED o CONSUMED ni holds vigentes',async()=>{
  const id=await raffle(3),cookie=await session();
  const expired=await expiredFixture(id,cookie);
  const live=await (await create(id,cookie)).json();
  assert.equal((await db.query('SELECT status FROM sorteos.checkout_holds WHERE id=$1',[expired])).rows[0].status,'EXPIRED');
  const next=await expiredFixture(id,await session());
  await app.get(CheckoutService).sweep();
  assert.equal((await db.query('SELECT status FROM sorteos.checkout_holds WHERE id=$1',[next])).rows[0].status,'EXPIRED');
  assert.equal((await (await access(live.holdId,cookie)).json()).status,'ACTIVE');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE status='RESERVED'")).rows[0].n,3);
  assert.equal((await db.query("SELECT status FROM sorteos.checkout_holds WHERE id='00000000-0000-4000-8000-000000000500'")).rows[0].status,'CONSUMED');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.audit_logs WHERE entity='checkout_holds' AND action='UPDATE'")).rows[0].n>0,true);
});
test('GET expira hold propio y reintento de cancelación no resucita ni reasigna boletos',async()=>{
  const id=await raffle(2),cookie=await session(),expired=await expiredFixture(id,cookie);
  assert.equal((await (await access(expired,cookie)).json()).status,'EXPIRED');
  assert.equal((await (await access(expired,cookie,'DELETE')).json()).status,'EXPIRED');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1 AND status='AVAILABLE'",[id])).rows[0].n,2);
});
test('sesión próxima a vencer debe renovarse antes de crear hold; renovación conserva el secreto',async()=>{
  const cookie=await session(),id=await raffle();
  const digest=createHash('sha256').update(cookie.split('=')[1]!).digest('hex');
  await db.query("UPDATE sorteos.guest_sessions SET expires_at=now()+interval '10 minutes' WHERE secret_hash=$1",[digest]);
  assert.equal((await create(id,cookie)).status,401);
  const renewed=await fetch(`${base}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin,Cookie:cookie}});
  assert.equal(renewed.status,201);assert.equal(renewed.headers.get('set-cookie')!.split(';')[0],cookie);
  assert.equal((await create(id,cookie)).status,201);
});
test('cancelar un hold CONSUMED rechaza la operación y conserva la reserva de la orden',async()=>{
  const secret=randomBytes(32).toString('base64url');
  await db.query("UPDATE sorteos.guest_sessions SET secret_hash=$1 WHERE id='00000000-0000-4000-8000-000000000400'",[createHash('sha256').update(secret).digest('hex')]);
  const response=await access('00000000-0000-4000-8000-000000000500',`sorteos_guest=${secret}`,'DELETE');
  assert.equal(response.status,409);assert.equal((await response.json()).error.code,'HOLD_CONSUMED');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE status='RESERVED'")).rows[0].n,3);
});
test('recuperación B3 rechaza datos; vacía restaura permisos B2, repara historial y reaplica',async()=>{
  const down=await readFile(resolve(workspaceRoot,'infra/recovery/b3-down-empty.sql'),'utf8');
  await db.query('BEGIN');try{await assert.rejects(()=>db.query(down),/Rollback B3 bloqueado/);}finally{await db.query('ROLLBACK');}
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL);const recoveryName=`${name}_recovery`;url.pathname=`/${recoveryName}`;
  await root.query(`CREATE DATABASE ${recoveryName}`);const recovery=new Client({connectionString:url.toString()});
  try{
    migrateLocal(url.toString());await recovery.connect();
    await revertEmptyB4(recovery,url.toString());
    const version=(await recovery.query("SELECT version FROM supabase_migrations.schema_migrations WHERE name='checkout_holds_b3'")).rows[0].version;
    await recovery.query('BEGIN');await recovery.query(down);await recovery.query('COMMIT');
    assert.equal((await recovery.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos'")).rows[0].n,13);
    assert.equal((await recovery.query("SELECT has_table_privilege('sorteos_runtime','sorteos.guest_sessions','SELECT') AS allowed")).rows[0].allowed,false);
    revertLocalMigrationHistory(url.toString(),version);migrateLocal(url.toString());
    assert.equal((await recovery.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos'")).rows[0].n,25);
  }finally{await recovery.end();await root.query(`DROP DATABASE ${recoveryName} WITH(FORCE)`);}
});
