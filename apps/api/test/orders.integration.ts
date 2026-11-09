import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { createApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { localDatabaseUrl, migrateLocal } from '../src/database/local-tools';
import { seedDemo } from '../src/database/seed-demo';
import { OrdersService } from '../src/orders/orders.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { DatabaseService } from '../src/database/database.service';
import { OrderDto } from '../src/orders/orders.dto';
import { revertEmptyB4 } from './recovery-tools';
import { createApiClient, submitOrder } from '../../../packages/api-client/src';

async function fetch(...args:Parameters<typeof globalThis.fetch>) {
  return await globalThis.fetch(...args) as Omit<Response,'json'> & {json():Promise<OrderDto & {error:{code:string}}>};
}
const name=`sorteos_b1_test_b4_${process.pid}`,login=`sorteos_b4_login_${process.pid}`,password=randomUUID();
const origin='http://localhost:3000',bankId=randomUUID();
const objects=new Map<string,Buffer>();
let root:Client,db:Client,app:INestApplication,peer:INestApplication,server:Server;
let base:string,peerBase:string,storageUrl:string,png:Buffer,jpg:Buffer,pdf:Buffer;
let rootConnected=false,created=false,loginCreated=false,publicBucket=false,uploadFail=false,deleteFail=false,uploads=0;
let onUpload:(()=>Promise<void>)|undefined;
before(async()=>{
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL);root=new Client({connectionString:url.toString()});await root.connect();rootConnected=true;
  await root.query(`CREATE DATABASE ${name}`);created=true;url.pathname=`/${name}`;migrateLocal(url.toString());
  db=new Client({connectionString:url.toString()});await db.connect();await seedDemo(db);
  await db.query("UPDATE sorteos.admin_users SET active=true WHERE role='OWNER'");
  await db.query("INSERT INTO sorteos.bank_accounts(id,bank_name,holder_name,account_type,account_display,active) VALUES($1,'BANCO DE PRUEBA','SOLO TEST','SAVINGS','NO TRANSFERIR — SIN CUENTA REAL',true)",[bankId]);
  await root.query(`CREATE ROLE ${login} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);loginCreated=true;
  await root.query(`GRANT sorteos_runtime TO ${login}`);url.username=login;url.password=password;
  server=createServer(async(req,res)=>{
    assert.equal(req.headers.apikey,'sb_secret_b4_fixture_server_only');
    if(req.method==='GET'&&req.url==='/storage/v1/bucket/receipts') {
      res.setHeader('content-type','application/json');res.end(JSON.stringify({id:'receipts',name:'receipts',public:publicBucket}));return;
    }
    if(req.method==='POST'&&req.url?.startsWith('/storage/v1/object/receipts/pending/')) {
      uploads++;const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
      const path=req.url.slice('/storage/v1/object/receipts/'.length);objects.set(path,Buffer.concat(chunks));
      if(onUpload)await onUpload();
      res.writeHead(uploadFail?500:200,{'content-type':'application/json'});res.end(JSON.stringify(uploadFail?{message:'Storage fixture failure'}:{Key:`receipts/${path}`}));return;
    }
    if(req.method==='DELETE'&&req.url==='/storage/v1/object/receipts') {
      let body='';for await(const chunk of req)body+=String(chunk);
      const paths=(JSON.parse(body) as {prefixes:string[]}).prefixes;
      if(!deleteFail)for(const path of paths)objects.delete(path);
      res.writeHead(deleteFail?500:200,{'content-type':'application/json'});res.end(JSON.stringify(deleteFail?{message:'delete unavailable'}:[]));return;
    }
    res.writeHead(404);res.end('{}');
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));storageUrl=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const config=parseConfig({NODE_ENV:'test',LOG_LEVEL:'silent',SWAGGER_ENABLED:'false',DATABASE_URL:url.toString(),DATABASE_SSL:'false',
    SUPABASE_URL:storageUrl,SUPABASE_STORAGE_KEY:'sb_secret_b4_fixture_server_only',RATE_LIMIT:'10000',HOLD_MAX_ACTIVE_IP:'1000',HOLD_HOURLY_IP:'10000',
    CHECKOUT_SESSION_HOURLY_IP:'10000',HOLD_SWEEP_MS:'3600000',CHECKOUT_ABUSE_HASH_KEY:'b4-fixture-key-'.repeat(4)});
  app=await createApp(config);await app.listen(0,'127.0.0.1');base=await app.getUrl();
  peer=await createApp(config);await peer.listen(0,'127.0.0.1');peerBase=await peer.getUrl();
  png=await sharp({create:{width:3,height:3,channels:3,background:'#fff'}}).png().toBuffer();
  jpg=await sharp(png).jpeg().toBuffer();const document=await PDFDocument.create();document.addPage([100,100]);pdf=Buffer.from(await document.save({useObjectStreams:false}));
});
after(async()=>{
  await app?.close();await peer?.close();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));await db?.end();
  if(rootConnected){if(created)await root.query(`DROP DATABASE ${name} WITH(FORCE)`);if(loginCreated)await root.query(`DROP ROLE ${login}`);await root.end();}
});
async function checkout(quantity=3,seconds?:number) {
  const raffle=randomUUID();
  await db.query(`INSERT INTO sorteos.raffles(inventory_policy,id,slug,title,description,prize,total_tickets,ticket_price_minor,min_purchase,max_purchase,rules,rules_version) VALUES ('LEGACY',$1,$2,'RIFA DEMO B4','PRUEBA','SIN VALOR REAL',100,10025,1,20,'NO TRANSFERIR','B4-TEST')`,[raffle,`demo-${raffle}`]);
  await db.query("INSERT INTO sorteos.raffle_media(raffle_id,storage_key,alt,position,rights_confirmed) VALUES($1,'prizes/test.webp','Fixture',0,true)",[raffle]);
  await db.query(`UPDATE sorteos.raffles SET status='PUBLISHED',publication_approved_at=now(),approved_rules_version=rules_version,
    publication_approved_by=(SELECT id FROM sorteos.admin_users WHERE role='OWNER') WHERE id=$1`,[raffle]);
  const opened=await fetch(`${base}/api/v1/checkout-session`,{method:'POST',headers:{Origin:origin}});assert.equal(opened.status,201);
  const cookie=opened.headers.get('set-cookie')!.split(';')[0]!;
  let holdId:string;
  if(seconds===undefined) {
    const held=await globalThis.fetch(`${base}/api/v1/checkout-holds`,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Idempotency-Key':randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({raffleId:raffle,quantity})});
    assert.equal(held.status,201);holdId=((await held.json()) as {holdId:string}).holdId;
  } else {
    const digest=createHash('sha256').update(cookie.split('=')[1]!).digest('hex');
    const sessionId=(await db.query('SELECT id FROM sorteos.guest_sessions WHERE secret_hash=$1',[digest])).rows[0].id;
    await db.query('BEGIN');
    try {
      holdId=(await db.query(`INSERT INTO sorteos.checkout_holds(raffle_id,session_id,quantity,unit_price_minor_snapshot,rules_version_snapshot,expires_at,idempotency_key,request_hash)
        VALUES($1,$2,$3,10025,'B4-TEST',now()+$4*interval '1 second',$5,repeat('b',64)) RETURNING id`,[raffle,sessionId,quantity,seconds,randomUUID()])).rows[0].id;
      await db.query("UPDATE sorteos.tickets SET status='HELD',hold_id=$1 WHERE id IN(SELECT id FROM sorteos.tickets WHERE raffle_id=$2 ORDER BY number LIMIT $3)",[holdId,raffle,quantity]);await db.query('COMMIT');
    }catch(e){await db.query('ROLLBACK');throw e;}
  }
  return {cookie,raffle,holdId,fields:{holdId,customerName:'CLIENTE DEMO B4',customerPhone:'+1 (809) 555-0100',customerEmail:'demo-b4@example.invalid',
    bankAccountId:bankId,bankReference:'REFERENCIA DEMO SIN TRANSFERENCIA',transferDate:new Date().toISOString(),acceptedRulesVersion:'B4-TEST'}};
}
type Checkout=Awaited<ReturnType<typeof checkout>>;
async function submit(c:Checkout,options:{key?:string;file?:Buffer|null;mime?:string;fields?:Record<string,string>;omit?:string;api?:string}={}) {
  const data=new FormData();
  for(const [key,value]of Object.entries({...c.fields,...options.fields}))if(key!==options.omit)data.append(key,value);
  const bytes=options.file===undefined?png:options.file;
  if(bytes)data.append('receipt',new Blob([new Uint8Array(bytes)],{type:options.mime??'image/png'}),'receipt.bin');
  return fetch(`${options.api??base}/api/v1/orders`,{method:'POST',headers:{Origin:origin,Cookie:c.cookie,'Idempotency-Key':options.key??randomUUID()},body:data});
}
async function orderCount(){return (await db.query('SELECT count(*)::int AS n FROM sorteos.orders')).rows[0].n as number;}
test('correo obligatorio y campos inválidos se rechazan antes de Storage; comprobante obligatorio',async()=>{
  const c=await checkout(),before=uploads,count=await orderCount();
  const cases:{omit?:string;fields?:Record<string,string>}[]=[{omit:'customerEmail'},{fields:{customerEmail:''}},{fields:{customerEmail:'invalid'}},{fields:{customerPhone:'809'}},
    {fields:{totalMinor:'1'}},{fields:{transferDate:'ayer'}}];
  for(const options of cases)assert.equal((await submit(c,options)).status,400);
  assert.equal((await submit(c,{file:null})).status,422);
  assert.equal(uploads,before);assert.equal(await orderCount(),count);
});
test('archivo MIME ajeno, falsificado, truncado o demasiado grande no crea orden ni upload',async()=>{
  const c=await checkout(),before=uploads;
  assert.equal((await submit(c,{file:Buffer.from('<svg/>'),mime:'image/svg+xml'})).status,415);
  for(const [file,mime]of [[Buffer.from('fake PNG'),'image/png'],[jpg.subarray(0,20),'image/jpeg'],[Buffer.from('%PDF-1.7\ninvalid\n%%EOF'),'application/pdf']] as [Buffer,string][]) {
    assert.equal((await submit(c,{file,mime})).status,422);
  }
  assert.equal((await submit(c,{file:Buffer.alloc(5242881)})).status,413);assert.equal(uploads,before);
});
test('PDF con JavaScript se rechaza; JPG y PDF estructuralmente válidos son aceptados',async()=>{
  const hostile=await PDFDocument.create();hostile.addPage();
  hostile.catalog.set(PDFName.of('OpenAction'),hostile.context.obj({S:PDFName.of('JavaScript'),JS:PDFString.of('alert(1)')}));
  assert.equal((await submit(await checkout(),{file:Buffer.from(await hostile.save()),mime:'application/pdf'})).status,422);
  for(const [file,mime]of [[jpg,'image/jpeg'],[pdf,'application/pdf']] as [Buffer,string][])assert.equal((await submit(await checkout(1),{file,mime})).status,201);
});
test('submit atómico muestra exactamente los números del hold, con ceros; nunca PII ni ruta privada',async()=>{
  const c=await checkout(3),count=await orderCount();
  const held=(await db.query('SELECT number FROM sorteos.tickets WHERE hold_id=$1 ORDER BY number',[c.holdId])).rows.map(r=>String(r.number).padStart(5,'0'));
  const res=await submit(c);assert.equal(res.status,201);assert.equal(res.headers.get('cache-control'),'no-store');
  const body=await res.json();assert.equal(body.status,'PENDING_REVIEW');assert.equal(body.paymentReportStatus,'REPORTED');assert.equal(body.totalMinor,30075);
  assert.deepEqual(body.ticketNumbers,held);assert.equal(body.quantity,3);assert.match(body.orderCode,/^RF-[A-F0-9]{32}$/);
  assert.ok(!JSON.stringify(body).includes('pending/'));assert.ok(!JSON.stringify(body).includes('example.invalid'));assert.ok(!JSON.stringify(body).includes('storage'));
  assert.equal(await orderCount(),count+1);
  const stored=(await db.query(`SELECT s.storage_path,s.sha256 FROM sorteos.receipt_staging s JOIN sorteos.orders o ON o.id=s.order_id WHERE o.order_code=$1 AND s.status='ATTACHED'`,[body.orderCode])).rows[0];
  assert.equal(createHash('sha256').update(objects.get(stored.storage_path)!).digest('hex'),stored.sha256);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1 AND status='RESERVED'",[c.raffle])).rows[0].n,3);
  await app.get(CheckoutService).sweep();assert.equal((await db.query('SELECT status FROM sorteos.checkout_holds WHERE id=$1',[c.holdId])).rows[0].status,'CONSUMED');
});
test('respuesta perdida y retry recuperan misma orden, números y archivo; payload cambiado da conflicto',async()=>{
  const c=await checkout(2),key=randomUUID(),count=await orderCount(),before=uploads;
  const first=await submit(c,{key});assert.equal(first.status,201);const original=await first.json();
  const retry=await submit(c,{key});assert.equal(retry.status,201);assert.deepEqual(await retry.json(),original);
  assert.equal(uploads,before+1);assert.equal(await orderCount(),count+1);
  const conflict=await submit(c,{key,fields:{customerEmail:'different@example.invalid'}});assert.equal(conflict.status,409);assert.equal((await conflict.json()).error.code,'IDEMPOTENCY_CONFLICT');
});
function uploadBarrier(){let count=0;let release:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});return async()=>{if(++count===2)release();await wait;};}
test('doble submit concurrente entre dos instancias crea una orden y conserva un solo archivo lógico',async()=>{
  const c=await checkout(2),key=randomUUID(),before=objects.size,count=await orderCount();onUpload=uploadBarrier();
  try {
    const responses=await Promise.all([submit(c,{key}),submit(c,{key,api:peerBase})]);
    for(const r of responses)assert.equal(r.status,201);
    assert.deepEqual(await responses[0]!.json(),await responses[1]!.json());assert.equal(await orderCount(),count+1);assert.equal(objects.size,before+1);
  }finally{onUpload=undefined;}
});
test('dos claves distintas para el mismo hold: una orden; el perdedor recibe HOLD_CONSUMED y compensa archivo',async()=>{
  const c=await checkout(1),count=await orderCount(),before=objects.size;onUpload=uploadBarrier();
  try {
    const responses=await Promise.all([submit(c),submit(c,{api:peerBase})]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    assert.equal((await responses.find(r=>r.status===409)!.json()).error.code,'HOLD_CONSUMED');assert.equal(await orderCount(),count+1);assert.equal(objects.size,before+1);
  }finally{onUpload=undefined;}
});
test('bucket público o Storage fallido no crea orden; carga ambigua se limpia y limpieza fallida se reintenta',async()=>{
  const c=await checkout(1),count=await orderCount();publicBucket=true;
  try{assert.equal((await submit(c)).status,503);}finally{publicBucket=false;}
  uploadFail=true;try{assert.equal((await submit(c)).status,503);}finally{uploadFail=false;}
  assert.equal(await orderCount(),count);assert.equal((await db.query('SELECT status FROM sorteos.checkout_holds WHERE id=$1',[c.holdId])).rows[0].status,'ACTIVE');
  await db.query("UPDATE sorteos.receipt_staging SET cleanup_after=now()-interval '1 second' WHERE status='PENDING'");
  deleteFail=true;try{await app.get(OrdersService).sweep();}finally{deleteFail=false;}
  assert.ok((await db.query("SELECT count(*)::int AS n FROM sorteos.receipt_staging WHERE status='CLEANING'")).rows[0].n>0);
  await db.query("UPDATE sorteos.receipt_staging SET cleanup_after=now()-interval '1 second' WHERE status='CLEANING'");await app.get(OrdersService).sweep();
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.receipt_staging WHERE status IN ('PENDING','CLEANING')")).rows[0].n,0);
});
test('hold vence durante upload: HOLD_EXPIRED, sin orden ni boletos reservados; no mantiene lock durante I/O',async()=>{
  const c=await checkout(1,4),count=await orderCount(),before=objects.size;
  onUpload=async()=>{
    await db.query('BEGIN');try{await db.query("SET LOCAL lock_timeout='1s'");await db.query('SELECT id FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[c.raffle]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}
    await new Promise(resolve=>setTimeout(resolve,4500));
  };
  try{const res=await submit(c);assert.equal(res.status,409);assert.equal((await res.json()).error.code,'HOLD_EXPIRED');}finally{onUpload=undefined;}
  assert.equal(await orderCount(),count);assert.equal(objects.size,before);
  await app.get(CheckoutService).sweep();assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1 AND status='AVAILABLE'",[c.raffle])).rows[0].n,100);
});
test('rollback después de crear cliente/orden no deja datos parciales y compensa Storage',async()=>{
  const c=await checkout(2),count=await orderCount(),before=objects.size;
  const customers=(await db.query('SELECT count(*)::int AS n FROM sorteos.customers')).rows[0].n;
  await db.query(`CREATE FUNCTION sorteos.test_fail_report() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'PRIVATE_TEST_DIAGNOSTIC' USING ERRCODE='23514'; END $$;
    CREATE TRIGGER test_fail BEFORE INSERT ON sorteos.payment_reports FOR EACH ROW EXECUTE FUNCTION sorteos.test_fail_report()`);
  try{const res=await submit(c);assert.equal(res.status,422);assert.ok(!JSON.stringify(await res.json()).includes('PRIVATE_TEST_DIAGNOSTIC'));}
  finally{await db.query('DROP TRIGGER test_fail ON sorteos.payment_reports;DROP FUNCTION sorteos.test_fail_report()');}
  assert.equal(await orderCount(),count);assert.equal(objects.size,before);assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.customers')).rows[0].n,customers);
  assert.equal((await db.query('SELECT status FROM sorteos.checkout_holds WHERE id=$1',[c.holdId])).rows[0].status,'ACTIVE');
});
test('consulta exige cookie propietaria, no solo código; accesos se auditan sin PII',async()=>{
  const c=await checkout(1),body=await (await submit(c)).json(),other=await checkout(1);
  const own=await fetch(`${base}/api/v1/orders/${body.orderCode}`,{headers:{Cookie:c.cookie}});assert.equal(own.status,200);assert.deepEqual((await own.json()).ticketNumbers,body.ticketNumbers);
  assert.equal((await fetch(`${base}/api/v1/orders/${body.orderCode}`)).status,401);
  assert.equal((await fetch(`${base}/api/v1/orders/${body.orderCode}`,{headers:{Cookie:other.cookie}})).status,404);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM sorteos.audit_logs WHERE action='ORDER_ACCESS'")).rows[0].n,1);
});
test('reglas, banco activo y autorización de sesión se revalidan; pausa permite terminar hold existente',async()=>{
  const c=await checkout(1),other=await checkout(1),count=await orderCount();
  assert.equal((await submit({...c,cookie:other.cookie})).status,404);
  assert.equal((await submit(c,{fields:{acceptedRulesVersion:'WRONG'}})).status,409);
  assert.equal((await submit(c,{fields:{bankAccountId:randomUUID()}})).status,422);
  assert.equal((await submit(c,{fields:{transferDate:'2099-01-01T00:00:00Z'}})).status,422);
  assert.equal(await orderCount(),count);
  await db.query("UPDATE sorteos.raffles SET status='PAUSED' WHERE id=$1",[c.raffle]);assert.equal((await submit(c)).status,201);
});
test('correo exigido también por DB y runtime sin permisos de aprobación ni cambios en administradores',async()=>{
  await assert.rejects(()=>db.query("INSERT INTO sorteos.customers(name,phone) VALUES('DEMO','+18095550100')"));
  const database=app.get(DatabaseService);
  for(const sql of ["UPDATE sorteos.orders SET status='PAID'","UPDATE sorteos.admin_users SET active=true",'SELECT * FROM sorteos.customers','SELECT * FROM sorteos.payment_reports'])await assert.rejects(()=>database.transaction(c=>c.query(sql)));
});
test('constraint diferida rechaza una orden con reporte inventado sin staging adjunto, aunque inventario sea coherente',async()=>{
  const c=await checkout(1),count=await orderCount();
  await assert.rejects(()=>app.get(DatabaseService).transaction(async client=>{
    const digest=createHash('sha256').update(c.cookie.split('=')[1]!).digest('hex');
    const sessionId=(await client.query('SELECT id FROM sorteos.guest_sessions WHERE secret_hash=$1',[digest])).rows[0].id;
    await client.query('SELECT id FROM sorteos.raffles WHERE id=$1 FOR UPDATE',[c.raffle]);
    const customer=(await client.query("INSERT INTO sorteos.customers(name,phone,email) VALUES('DEMO','+18095550100','demo@example.invalid') RETURNING id")).rows[0].id;
    const order=(await client.query(`INSERT INTO sorteos.orders(order_code,raffle_id,customer_id,session_id,hold_id,ticket_quantity,unit_price_minor,
      rules_version_snapshot,lookup_secret_hash,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5,1,10025,'B4-TEST',repeat('a',64),$6,repeat('b',64)) RETURNING id`,
      [`RF-${randomUUID().replaceAll('-','').toUpperCase()}`,c.raffle,customer,sessionId,c.holdId,randomUUID()])).rows[0].id;
    await client.query('INSERT INTO sorteos.order_tickets(order_id,ticket_id,raffle_id) SELECT $1,id,raffle_id FROM sorteos.tickets WHERE hold_id=$2',[order,c.holdId]);
    await client.query(`INSERT INTO sorteos.payment_reports(order_id,bank_account_id,reference,transfer_date,receipt_storage_path,receipt_sha256)
      VALUES($1,$2,'SIN ARCHIVO REAL',now(),'receipts/demo/no-file.png',repeat('c',64))`,[order,bankId]);
    await client.query("UPDATE sorteos.tickets SET status='RESERVED',hold_id=NULL,current_order_id=$1 WHERE hold_id=$2",[order,c.holdId]);
    await client.query("UPDATE sorteos.checkout_holds SET status='CONSUMED' WHERE id=$1",[c.holdId]);
  }),/Orden requiere correo y comprobante privado adjunto/);
  assert.equal(await orderCount(),count);
});
test('limpiador que reclama staging durante upload impide confirmar una orden con archivo eliminado',async()=>{
  const c=await checkout(1),count=await orderCount(),before=objects.size;
  onUpload=async()=>{
    await db.query("UPDATE sorteos.receipt_staging SET cleanup_after=now()-interval '1 second' WHERE status='PENDING'");
    await app.get(OrdersService).sweep();
  };
  try{assert.equal((await submit(c)).status,503);}finally{onUpload=undefined;}
  assert.equal(await orderCount(),count);assert.equal(objects.size,before);
  assert.equal((await db.query('SELECT status FROM sorteos.checkout_holds WHERE id=$1',[c.holdId])).rows[0].status,'ACTIVE');
});
test('cambios administrativos durante Storage se revalidan antes de crear la orden',async()=>{
  const c=await checkout(1),count=await orderCount(),before=objects.size;
  onUpload=async()=>{await db.query("UPDATE sorteos.raffles SET status='PAUSED',rules_version='CHANGED' WHERE id=$1",[c.raffle]);};
  try{const res=await submit(c);assert.equal(res.status,409);assert.equal((await res.json()).error.code,'RULES_CHANGED');}finally{onUpload=undefined;}
  assert.equal(await orderCount(),count);assert.equal(objects.size,before);
});
test('cliente tipado envía multipart real con boundary, correo obligatorio y cookie reenviada desde SSR',async()=>{
  const c=await checkout(1),client=createApiClient(base);
  client.use({onRequest({request}){request.headers.set('Cookie',c.cookie);request.headers.set('Origin',origin);return request;}});
  const result=await submitOrder(client,{...c.fields,receipt:new Blob([new Uint8Array(png)],{type:'image/png'})},randomUUID(),origin);
  assert.equal(result.response.status,201);assert.equal(result.data?.status,'PENDING_REVIEW');assert.equal(result.data?.ticketNumbers.length,1);
});
test('recuperación B4 rechaza datos; vacía conserva B3, repara historial oficial y permite reaplicar',async()=>{
  await assert.rejects(()=>revertEmptyB4(db,localDatabaseUrl(process.env.TEST_DATABASE_URL).toString()),/Rollback B[45] bloqueado/);
  const url=localDatabaseUrl(process.env.TEST_DATABASE_URL),recoveryName=`${name}_recovery`;url.pathname=`/${recoveryName}`;
  await root.query(`CREATE DATABASE ${recoveryName}`);const recovery=new Client({connectionString:url.toString()});
  try{
    migrateLocal(url.toString());await recovery.connect();await revertEmptyB4(recovery,url.toString());
    assert.equal((await recovery.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos'")).rows[0].n,14);
    assert.equal((await recovery.query("SELECT has_table_privilege('sorteos_runtime','sorteos.orders','INSERT') AS allowed")).rows[0].allowed,false);
    migrateLocal(url.toString());assert.equal((await recovery.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos'")).rows[0].n,26);
  }finally{await recovery.end();await root.query(`DROP DATABASE ${recoveryName} WITH(FORCE)`);}
});
