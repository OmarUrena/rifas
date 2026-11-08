import 'reflect-metadata';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { INestApplication } from '@nestjs/common';
import { Client } from 'pg';
import { createApp } from '../src/bootstrap';
import { parseConfig } from '../src/config/config';
import { localDatabaseUrl, migrateLocal, workspaceRoot } from '../src/database/local-tools';
import { seedDemo } from '../src/database/seed-demo';
import { DatabaseService } from '../src/database/database.service';
import { SharedThrottlerStorage } from '../src/common/shared-throttler';

const name=`sorteos_b1_test_m6_${process.pid}`;
let root:Client,db:Client,url:URL,first:INestApplication,second:INestApplication,base:string,peer:string;
let connected=false,created=false;
const reports=resolve(workspaceRoot,'.tmp/m6');
const settings={NODE_ENV:'test',LOG_LEVEL:'silent',SWAGGER_ENABLED:'false',DATABASE_SSL:'false',
  HTTP_RATE_STORE:'postgres',CHECKOUT_ABUSE_HASH_KEY:'m6-test-shared-secret-'.repeat(3),HOLD_SWEEP_MS:'3600000'};
before(async()=>{
  url=localDatabaseUrl(process.env.TEST_DATABASE_URL);
  root=new Client({connectionString:url.toString()});await root.connect();connected=true;
  await root.query(`CREATE DATABASE ${name}`);created=true;url.pathname=`/${name}`;
  migrateLocal(url.toString());db=new Client({connectionString:url.toString()});await db.connect();await seedDemo(db);
  const config=parseConfig({...settings,DATABASE_URL:url.toString(),RATE_LIMIT:'8',RATE_TTL_MS:'1500'});
  first=await createApp(config);second=await createApp(config);
  await first.listen(0,'127.0.0.1');await second.listen(0,'127.0.0.1');base=await first.getUrl();peer=await second.getUrl();
  await mkdir(reports,{recursive:true});
});
after(async()=>{
  await first?.close();await second?.close();await db?.end();
  if(connected){if(created)await root.query(`DROP DATABASE ${name} WITH(FORCE)`);await root.end();}
});

test('M6: presupuesto HTTP atómico entre dos instancias, 429 y Retry-After; no confía en cabeceras de proxy',async()=>{
  const responses=await Promise.all(Array.from({length:24},(_,i)=>fetch(`${i%2?peer:base}/api/v1/raffles`,{
    headers:{'X-Forwarded-For':`198.51.100.${i+1}`},
  })));
  assert.equal(responses.filter(r=>r.status===200).length,8);
  assert.equal(responses.filter(r=>r.status===429).length,16);
  for(const response of responses.filter(r=>r.status===429)){
    assert.ok(Number(response.headers.get('retry-after'))>0);
    const payload=await response.json() as {error:{code:string}};
    assert.equal(payload.error.code,'RATE_LIMITED');
  }
  const row=await db.query('SELECT key,hits FROM sorteos.http_rate_limits');
  assert.equal(row.rowCount,1);assert.match(row.rows[0].key,/^[a-f0-9]{64}$/);assert.equal(row.rows[0].hits,9);
  const repeat=await fetch(`${base}/api/v1/raffles`,{headers:{Forwarded:'for=198.51.100.99'}});
  assert.equal(repeat.status,429);
  await new Promise(r=>setTimeout(r,1700));
  assert.equal((await fetch(`${peer}/api/v1/raffles`)).status,200);
});

test('M6: ventana, bloqueo y limpieza acotada usan reloj DB; claves HMAC sin identificadores en claro',async()=>{
  const config=parseConfig({...settings,DATABASE_URL:url.toString()});
  const storage=new SharedThrottlerStorage(first.get(DatabaseService),config);
  const marker='DEMO-IP-'+randomUUID();
  const firstHit=await storage.increment(marker,10000,2,20000,'default');assert.equal(firstHit.totalHits,1);
  assert.equal((await storage.increment(marker,10000,2,20000,'default')).isBlocked,false);
  const blocked=await storage.increment(marker,10000,2,20000,'default');assert.equal(blocked.isBlocked,true);
  assert.ok(blocked.timeToBlockExpire>0);assert.ok(blocked.timeToBlockExpire<=20);
  const rows=await db.query('SELECT key FROM sorteos.http_rate_limits');
  assert.ok(rows.rows.every(row=>!row.key.includes(marker)&&/^[a-f0-9]{64}$/.test(row.key)));
  await db.query("INSERT INTO sorteos.http_rate_limits(key,hits,expires_at) VALUES($1,1,now()-interval '2 hours')",['f'.repeat(64)]);
  await new SharedThrottlerStorage(first.get(DatabaseService),config).increment(randomUUID(),1000,2,1000,'default');
  assert.equal((await db.query('SELECT 1 FROM sorteos.http_rate_limits WHERE key=$1',['f'.repeat(64)])).rowCount,0);
  await assert.rejects(()=>db.query("SET ROLE sorteos_runtime; INSERT INTO sorteos.http_rate_limits(key,hits,expires_at) VALUES('raw-ip',1,now())"));
  await db.query('RESET ROLE');
});

test('M6: pérdida del almacén compartido falla cerrada; liveness sigue disponible',async()=>{
  await db.query('ALTER TABLE sorteos.http_rate_limits RENAME TO m6_rate_unavailable');
  try{
    assert.equal((await fetch(`${peer}/api/v1/raffles`)).status,503);
    assert.equal((await fetch(`${base}/api/v1/health`)).status,200);
  }finally{await db.query('ALTER TABLE sorteos.m6_rate_unavailable RENAME TO http_rate_limits');}
});

function pgTool(name:string,database:URL,args:string[]) {
  const executable=process.env.TEST_PG_BIN?join(process.env.TEST_PG_BIN,name+(process.platform==='win32'?'.exe':'')):name;
  // Drop inherited libpq service/options/host overrides rather than assigning empty strings.
  const cleanEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('PG')));
  try{return execFileSync(executable,args,{encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe'],env:{...cleanEnv,
    PGHOST:database.hostname,PGPORT:database.port||'5432',PGUSER:decodeURIComponent(database.username),
    PGPASSWORD:decodeURIComponent(database.password),PGDATABASE:database.pathname.slice(1),PGSSLMODE:'disable',
  }});}catch(error){
    let detail=error&&typeof error==='object'&&'stderr' in error?String(error.stderr):'Herramienta no disponible';
    for(const secret of [database.toString(),database.password,decodeURIComponent(database.password)])if(secret)detail=detail.split(secret).join('[REDACTED]');
    detail=detail.replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[DB_URL]');
    throw new Error(`M6: ${name} falló: ${detail.slice(-1600)}`);
  }
}
async function snapshot(client:Client) {
  await client.query("SET TIME ZONE 'UTC'");
  const tables=await client.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='sorteos' ORDER BY tablename");
  const data:Record<string,{digest:string;count:number}>={};
  for(const {tablename}of tables.rows){
    assert.match(tablename,/^[a-z_]+$/);
    const result=await client.query(`SELECT md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),'')) AS digest,count(*)::int AS count FROM sorteos."${tablename}" t`);
    data[tablename]=result.rows[0];
  }
  return data;
}

test('S06 M6: pg_dump custom + pg_restore en DB nueva conservan datos, inventario, RLS y restricciones',async()=>{
  const restoredName=`${name}_restore`,restoreUrl=new URL(url);restoreUrl.pathname=`/${restoredName}`;
  const archive=join(reports,`demo-${process.pid}.dump`),started=performance.now();
  const expected=await snapshot(db);
  pgTool('pg_dump',url,['--format=custom','--no-owner','--schema=sorteos','--schema=supabase_migrations','--file',archive]);
  const archiveHash=createHash('sha256').update(await readFile(archive)).digest('hex');
  assert.ok(pgTool('pg_restore',url,['--list',archive]).includes('sorteos'));
  await root.query(`CREATE DATABASE ${restoredName} TEMPLATE template0`);
  const restored=new Client({connectionString:restoreUrl.toString()});
  try{
    pgTool('pg_restore',restoreUrl,['--dbname',restoredName,'--exit-on-error','--single-transaction','--no-owner',archive]);
    await restored.connect();assert.deepEqual(await snapshot(restored),expected);
    const rls=await restored.query("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname='sorteos' AND rowsecurity");
    assert.equal(rls.rows[0].n,18);
    assert.equal((await restored.query("SELECT has_table_privilege('sorteos_runtime','sorteos.http_rate_limits','UPDATE') AS allowed")).rows[0].allowed,true);
    const pending=await restored.query(`SELECT o.ticket_quantity AS quantity,(SELECT count(*)::int FROM sorteos.order_tickets ot JOIN sorteos.tickets t ON t.id=ot.ticket_id WHERE ot.order_id=o.id AND t.status='RESERVED') AS reserved FROM sorteos.orders o WHERE o.status='PENDING_REVIEW'`);
    assert.equal(pending.rowCount,1);assert.equal(pending.rows[0].quantity,pending.rows[0].reserved);
    await assert.rejects(()=>restored.query("INSERT INTO sorteos.tickets(raffle_id,number) SELECT raffle_id,number FROM sorteos.tickets LIMIT 1"),{code:'23505'});
    await assert.rejects(()=>restored.query("UPDATE sorteos.raffles SET status='DRAWN'"),{code:'23514'});
    migrateLocal(restoreUrl.toString());
    assert.equal((await restored.query('SELECT count(*)::int AS n FROM supabase_migrations.schema_migrations')).rows[0].n,11);
    const report={scenario:'S06',result:'PASS',tables:18,archiveSha256:archiveHash,durationMs:Math.round(performance.now()-started),
      pendingOrderPreserved:true,rls:true,constraints:true,storageBytes:'NOT_INCLUDED_IN_SQL_BACKUP'};
    await writeFile(join(reports,'restore.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await restored.end();await root.query(`DROP DATABASE ${restoredName} WITH(FORCE)`);}
});
