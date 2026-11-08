import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { Client } from 'pg';
import { localDatabaseUrl, migrateLocal, workspaceRoot } from '../src/database/local-tools';
import { seedDemo } from '../src/database/seed-demo';

const name = `sorteos_b1_test_${process.pid}`;
const readerRole = `sorteos_b1_reader_${process.pid}`;
const raffle = '00000000-0000-4000-8000-000000000100';
const order = '00000000-0000-4000-8000-000000000600';
const hold = '00000000-0000-4000-8000-000000000500';
const report = '00000000-0000-4000-8000-000000000700';
const admin = '00000000-0000-4000-8000-000000000010';
let owner: Client;
let db: Client;
let ownerConnected = false;
let databaseCreated = false;
let readerCreated = false;

before(async () => {
  const root = localDatabaseUrl(process.env.TEST_DATABASE_URL);
  owner = new Client({ connectionString: root.toString() });
  await owner.connect();
  ownerConnected = true;
  // Base creada exclusivamente por esta prueba; no ejecutar SQL de dominio en la DB suministrada.
  await owner.query(`CREATE DATABASE ${name}`);
  databaseCreated = true;
  root.pathname = `/${name}`;
  migrateLocal(root.toString());
  migrateLocal(root.toString()); // Reintento sin duplicar historial.
  db = new Client({ connectionString: root.toString() });
  await db.connect();
  await seedDemo(db);
});

after(async () => {
  await db?.end();
  if (ownerConnected) {
    // Identificadores generados internamente; nunca se interpolan nombres del usuario.
    if (databaseCreated) await owner.query(`DROP DATABASE ${name} WITH (FORCE)`);
    if (readerCreated) await owner.query(`DROP ROLE ${readerRole}`);
    await owner.end();
  }
});

async function rollbackCase(work: () => Promise<void>): Promise<void> {
  await db.query('BEGIN');
  try { await work(); } finally { await db.query('ROLLBACK'); }
}

async function rejectsSql(sql: string, params: unknown[] = [], codes = ['23514','23505','23503','23502']): Promise<void> {
  await rollbackCase(async () => {
    await assert.rejects(async () => {
      await db.query(sql, params);
      await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    }, (error: unknown) => {
      assert.ok(typeof error === 'object' && error !== null && 'code' in error);
      assert.ok(codes.includes(String(error.code)), `SQLSTATE inesperado: ${String(error.code)}`);
      return true;
    });
  });
}

async function createRaffle(total: number): Promise<string> {
  const id = randomUUID();
  await db.query(`INSERT INTO sorteos.raffles(inventory_policy,id,slug,title,description,prize,total_tickets,
    ticket_price_minor,min_purchase,max_purchase,rules,rules_version) VALUES ('LEGACY',$1,$2,'DEMO TEST','Fixture','PREMIO DEMO',$3,10025,1,1,'Solo pruebas','TEST-1')`,
  [id, `test-${id}`, total]);
  return id;
}

test('migración oficial repetida conserva una sola versión', async () => {
  const result = await db.query('SELECT count(*)::int AS n FROM supabase_migrations.schema_migrations');
  const files = await readdir(resolve(workspaceRoot,'infra/supabase/migrations'));
  assert.equal(result.rows[0].n, files.filter(file=>/^\d+_.*\.sql$/.test(file)).length);
});

test('nuevo seed configura rango virtual, no crea tickets y protege política/rango en DB',async()=>{
  await db.query(await readFile(resolve(workspaceRoot,'infra/seeds/stage2-demo.sql'),'utf8'));
  await db.query(await readFile(resolve(workspaceRoot,'infra/seeds/stage2-demo.sql'),'utf8'));
  const id='00000000-0000-4000-8000-000000000802';
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1',[id])).rows[0].n,0);
  assert.equal((await db.query('SELECT total_tickets FROM sorteos.raffles WHERE id=$1',[id])).rows[0].total_tickets,100000);
  await rejectsSql('UPDATE sorteos.raffles SET inventory_policy=\'LEGACY\' WHERE id=$1',[id]);
  await rejectsSql('INSERT INTO sorteos.tickets(raffle_id,number) VALUES($1,100000)',[id]);
  await rejectsSql('INSERT INTO sorteos.tickets(raffle_id,number) VALUES($1,-1)',[id]);
  await rejectsSql('UPDATE sorteos.raffles SET fundraising_target_minor=2 WHERE id=$1',[id]);
  await db.query('BEGIN');
  try{
    await db.query('INSERT INTO sorteos.tickets(raffle_id,number) VALUES($1,0),($1,99999)',[id]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.tickets WHERE raffle_id=$1',[id])).rows[0].n,2);
  }finally{await db.query('ROLLBACK');}
});

test('seed DEMO reejecutable conserva datos, reservas y auditoría', async () => {
  const before = await db.query(`SELECT (SELECT count(*) FROM sorteos.audit_logs)::int AS audits,
    (SELECT count(*) FROM sorteos.orders)::int AS orders`);
  await seedDemo(db);
  const after = await db.query(`SELECT (SELECT count(*) FROM sorteos.audit_logs)::int AS audits,
    (SELECT count(*) FROM sorteos.orders)::int AS orders`);
  assert.deepEqual(after.rows, before.rows);
  const result = await db.query(`SELECT count(*)::int AS n, min(number) AS min, max(number) AS max,
    count(*) FILTER (WHERE status='RESERVED')::int AS reserved FROM sorteos.tickets WHERE raffle_id=$1`,[raffle]);
  assert.deepEqual(result.rows[0], { n:100,min:0,max:99,reserved:3 });
});

test('R01/R02/R03: N exacto, único y rango 0..N-1 para 1, 10, 137 y 10000', async () => {
  await rollbackCase(async () => {
    for (const n of [1,10,137,10000]) {
      const id = await createRaffle(n);
      const result = await db.query(`SELECT count(*)::int AS n, count(DISTINCT number)::int AS unique,
        min(number) AS min, max(number) AS max FROM sorteos.tickets WHERE raffle_id=$1`,[id]);
      assert.deepEqual(result.rows[0], { n, unique:n, min:0, max:n-1 });
      const width = await db.query('SELECT ticket_width FROM sorteos.raffles WHERE id=$1',[id]);
      assert.equal(width.rows[0].ticket_width, String(n-1).length);
    }
  });
});

test('R04: cantidades inválidas fallan sin generar inventario parcial', async () => {
  for (const n of [0,-1,1000001]) {
    await rollbackCase(async () => { await assert.rejects(() => createRaffle(n)); });
  }
  await rejectsSql('UPDATE sorteos.raffles SET min_purchase=0 WHERE id=$1',[raffle]);
  await rejectsSql('UPDATE sorteos.raffles SET max_purchase=101 WHERE id=$1',[raffle]);
});

test('duplicados, negativos, rango y renumeración se rechazan en PostgreSQL', async () => {
  await rejectsSql('INSERT INTO sorteos.tickets(raffle_id,number) VALUES ($1,0)',[raffle]);
  await rejectsSql('INSERT INTO sorteos.tickets(raffle_id,number) VALUES ($1,-1)',[raffle]);
  await rejectsSql('INSERT INTO sorteos.tickets(raffle_id,number) VALUES ($1,100)',[raffle]);
  await rejectsSql('UPDATE sorteos.tickets SET number=77 WHERE raffle_id=$1 AND number=4',[raffle]);
  await rejectsSql('UPDATE sorteos.raffles SET total_tickets=101 WHERE id=$1',[raffle]);
});

test('R06: precio comprometido y snapshots son inmutables', async () => {
  await rejectsSql('UPDATE sorteos.raffles SET ticket_price_minor=10000 WHERE id=$1',[raffle]);
  await rejectsSql('UPDATE sorteos.orders SET unit_price_minor=1 WHERE id=$1',[order]);
  await rejectsSql('UPDATE sorteos.checkout_holds SET quantity=4 WHERE id=$1',[hold]);
});

test('O14: total exacto en centavos DOP generado por la DB', async () => {
  const result = await db.query('SELECT unit_price_minor::text,total_minor::text,currency FROM sorteos.orders WHERE id=$1',[order]);
  assert.deepEqual(result.rows[0], { unit_price_minor:'10025',total_minor:'30075',currency:'DOP' });
  await rejectsSql('UPDATE sorteos.orders SET total_minor=1 WHERE id=$1',[order],['428C9']);
  await rejectsSql('UPDATE sorteos.raffles SET ticket_price_minor=9007199254740992 WHERE id=$1',[raffle]);
});

test('comprobante obligatorio y privado: no se confirma una orden sin archivo lógico', async () => {
  await rejectsSql('UPDATE sorteos.payment_reports SET active=false WHERE order_id=$1',[order]);
  await rejectsSql(`INSERT INTO sorteos.payment_reports(order_id,bank_account_id,reference,transfer_date,
    receipt_storage_path,receipt_sha256,revision,active)
    SELECT order_id,bank_account_id,'DEMO',now(),'https://public.invalid/file.pdf',receipt_sha256,2,false
    FROM sorteos.payment_reports WHERE id=$1`,[report]);
  await rejectsSql('UPDATE sorteos.payment_reports SET order_id=$1 WHERE id=$2',[randomUUID(),report]);
});

test('O02: insertar orden y boletos sin reporte de pago falla al confirmar', async () => {
  await rollbackCase(async () => {
    const newHold = randomUUID();
    const newOrder = randomUUID();
    await db.query(`INSERT INTO sorteos.checkout_holds(id,raffle_id,session_id,quantity,
      unit_price_minor_snapshot,rules_version_snapshot,expires_at,idempotency_key,request_hash)
      SELECT $1,raffle_id,session_id,1,unit_price_minor_snapshot,rules_version_snapshot,
      now()+interval '1 hour',$2,request_hash FROM sorteos.checkout_holds WHERE id=$3`,[newHold,randomUUID(),hold]);
    await db.query("UPDATE sorteos.tickets SET status='HELD',hold_id=$1 WHERE raffle_id=$2 AND number=3",[newHold,raffle]);
    await db.query(`INSERT INTO sorteos.orders(id,order_code,raffle_id,customer_id,session_id,hold_id,
      ticket_quantity,unit_price_minor,rules_version_snapshot,lookup_secret_hash,idempotency_key,request_hash)
      SELECT $1,$2,raffle_id,customer_id,session_id,$3,1,unit_price_minor,rules_version_snapshot,
      lookup_secret_hash,$4,request_hash FROM sorteos.orders WHERE id=$5`,
    [newOrder,`RF-${randomUUID().replaceAll('-','').toUpperCase()}`,newHold,randomUUID(),order]);
    await db.query('INSERT INTO sorteos.order_tickets(order_id,ticket_id,raffle_id) SELECT $1,id,raffle_id FROM sorteos.tickets WHERE hold_id=$2',[newOrder,newHold]);
    await db.query("UPDATE sorteos.tickets SET status='RESERVED',hold_id=NULL,current_order_id=$1 WHERE hold_id=$2",[newOrder,newHold]);
    await db.query("UPDATE sorteos.checkout_holds SET status='CONSUMED' WHERE id=$1",[newHold]);
    await assert.rejects(() => db.query('SET CONSTRAINTS ALL IMMEDIATE'), /Comprobante obligatorio/);
  });
});

test('idempotencia por sesión, hold consumible una vez y reporte activo único', async () => {
  await rejectsSql(`INSERT INTO sorteos.checkout_holds(raffle_id,session_id,quantity,unit_price_minor_snapshot,
    rules_version_snapshot,expires_at,idempotency_key,request_hash)
    SELECT raffle_id,session_id,quantity,unit_price_minor_snapshot,rules_version_snapshot,now()+interval '1 hour',
    idempotency_key,request_hash FROM sorteos.checkout_holds WHERE id=$1`,[hold]);
  await rejectsSql(`INSERT INTO sorteos.payment_reports(order_id,bank_account_id,reference,transfer_date,
    receipt_storage_path,receipt_sha256,revision)
    SELECT order_id,bank_account_id,'DEMO',now(),receipt_storage_path,receipt_sha256,2
    FROM sorteos.payment_reports WHERE id=$1`,[report]);
  await rejectsSql('UPDATE sorteos.checkout_holds SET status=\'ACTIVE\' WHERE id=$1',[hold]);
});

test('P07/P08: INVALID y NEEDS_RESOLUTION conservan los boletos RESERVED', async () => {
  await rollbackCase(async () => {
    await db.query("UPDATE sorteos.orders SET status='NEEDS_RESOLUTION' WHERE id=$1",[order]);
    await db.query("UPDATE sorteos.payment_reports SET status='INVALID' WHERE id=$1",[report]);
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    const result = await db.query("SELECT count(*)::int AS n FROM sorteos.tickets WHERE current_order_id=$1 AND status='RESERVED'",[order]);
    assert.equal(result.rows[0].n,3);
  });
  await rejectsSql("UPDATE sorteos.tickets SET status='AVAILABLE',current_order_id=NULL WHERE current_order_id=$1",[order]);
});

test('PAID exige verificación completa y todos sus boletos SOLD', async () => {
  await rejectsSql("UPDATE sorteos.orders SET status='PAID',reviewed_by=$1,reviewed_at=now() WHERE id=$2",[admin,order]);
  await rollbackCase(async () => {
    await db.query(`UPDATE sorteos.payment_reports SET status='VERIFIED',verified_amount_minor=30075,
      bank_posted_at=now(),bank_confirmation_reference='DEMO-VERIFICACION-SIMULADA',reviewer_id=$1,reviewed_at=now()
      WHERE id=$2`,[admin,report]);
    await db.query("UPDATE sorteos.orders SET status='PAID',reviewed_by=$1,reviewed_at=now() WHERE id=$2",[admin,order]);
    await db.query("UPDATE sorteos.tickets SET status='SOLD' WHERE current_order_id=$1",[order]);
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    await assert.rejects(() => db.query("UPDATE sorteos.orders SET status='CANCELLED' WHERE id=$1",[order]));
  });
});

test('cancelación sin conciliación se rechaza; resolución documentada conserva ledger', async () => {
  await rejectsSql("UPDATE sorteos.orders SET status='CANCELLED' WHERE id=$1",[order]);
  await rollbackCase(async () => {
    await db.query(`UPDATE sorteos.orders SET status='CANCELLED',reviewed_by=$1,reviewed_at=now(),
      cancel_reason='DEMO sin ingreso real',resolution_type='NOT_PAID_CONFIRMED',evidence_reference='DEMO-INC-1' WHERE id=$2`,[admin,order]);
    await db.query('UPDATE sorteos.order_tickets SET released_at=now() WHERE order_id=$1',[order]);
    await db.query("UPDATE sorteos.tickets SET status='AVAILABLE',current_order_id=NULL WHERE current_order_id=$1",[order]);
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    const result = await db.query('SELECT count(*)::int AS n FROM sorteos.order_tickets WHERE order_id=$1 AND released_at IS NOT NULL',[order]);
    assert.equal(result.rows[0].n,3);
  });
});

test('historial contable y auditoría no se borran, actualizan ni truncan', async () => {
  for (const table of ['orders','payment_reports','tickets','order_tickets','audit_logs']) {
    await rejectsSql(`DELETE FROM sorteos.${table}`);
  }
  await rejectsSql("UPDATE sorteos.audit_logs SET action='EDIT'");
  await rejectsSql('TRUNCATE sorteos.audit_logs');
});

test('auditoría contiene solo referencias y estados, sin PII ni comprobante', async () => {
  const result = await db.query('SELECT * FROM sorteos.audit_logs ORDER BY created_at');
  assert.ok(result.rows.length >= 110);
  assert.ok(result.rows.every(row => row.request_id && row.actor_kind === 'SEED'));
  const serialized = JSON.stringify(result.rows);
  for (const secret of ['CLIENTE DEMO','+18095550100','example.invalid','comprobante-simulado.pdf',repeatSecret()]) {
    assert.ok(!serialized.includes(secret));
  }
});
function repeatSecret() { return '4'.repeat(64); }

test('RLS y permisos deniegan acceso a un rol con grants pero sin políticas', async () => {
  await owner.query(`CREATE ROLE ${readerRole} NOLOGIN`);
  readerCreated = true;
  await rollbackCase(async () => {
    await db.query(`GRANT USAGE ON SCHEMA sorteos TO ${readerRole}`);
    await db.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA sorteos TO ${readerRole}`);
    await db.query(`SET LOCAL ROLE ${readerRole}`);
    assert.equal((await db.query('SELECT * FROM sorteos.customers')).rows.length,0);
    assert.equal((await db.query("UPDATE sorteos.customers SET name='DEMO' RETURNING id")).rows.length,0);
    await assert.rejects(() => db.query(`INSERT INTO sorteos.customers(name,phone) VALUES ('DEMO','+18095550100')`));
  });
  const tables = await db.query("SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sorteos' AND c.relkind='r' AND NOT c.relrowsecurity");
  assert.equal(tables.rows.length,0);
  const functions = await db.query<{oid:number;proname:string;proconfig:string[];owner:string;unexpected:number}>(`SELECT p.oid,p.proname,p.proconfig,pg_get_userbyid(p.proowner) AS owner,
    (SELECT count(*)::int FROM aclexplode(p.proacl) acl WHERE acl.privilege_type='EXECUTE'
      AND acl.grantee NOT IN (p.proowner,'sorteos_runtime'::regrole::oid)) AS unexpected
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sorteos' AND p.prosecdef ORDER BY p.proname`);
  assert.deepEqual(functions.rows.map(f=>f.proname),['admin_auth_session_valid','development_checkout_valid','development_mfa_access_valid']);
  for(const fn of functions.rows){
    assert.deepEqual(fn.proconfig,['search_path=""']);assert.notEqual(fn.owner,'sorteos_runtime');assert.equal(fn.unexpected,0);
    assert.equal((await db.query("SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed",[readerRole,fn.oid])).rows[0].allowed,false);
  }
});

test('sorteo real bloqueado en el esquema B1', async () => {
  await rejectsSql("UPDATE sorteos.raffles SET status='DRAWN' WHERE id=$1",[raffle]);
});

test('recuperación negativa: down no permite borrar un esquema con datos', async () => {
  const down = await readFile(resolve(workspaceRoot,'infra/recovery/b1-down-empty.sql'),'utf8');
  await rollbackCase(async () => { await assert.rejects(() => db.query(down)); });
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sorteos.orders')).rows[0].n,1);
});

test('recuperación positiva: down elimina solamente el esquema vacío en otra DB desechable', async () => {
  const recoveryName = `${name}_recovery`;
  const url = localDatabaseUrl(process.env.TEST_DATABASE_URL);
  url.pathname = `/${recoveryName}`;
  await owner.query(`CREATE DATABASE ${recoveryName}`);
  const recovery = new Client({ connectionString:url.toString() });
  try {
    migrateLocal(url.toString());
    await recovery.connect();
    const down = await readFile(resolve(workspaceRoot,'infra/recovery/b1-down-empty.sql'),'utf8');
    await recovery.query('BEGIN');
    await recovery.query(down);
    await recovery.query('COMMIT');
    const result = await recovery.query("SELECT 1 FROM pg_namespace WHERE nspname='sorteos'");
    assert.equal(result.rows.length,0);
  } finally {
    await recovery.end();
    await owner.query(`DROP DATABASE ${recoveryName} WITH (FORCE)`);
  }
});
