import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { revertLocalMigrationHistory, workspaceRoot } from '../src/database/local-tools';

export async function revertEmptyB4(client:Client,url:string) {
  await revertEmptyB5(client,url);
  const history=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name='order_receipts_b4'");
  if(!history.rows[0])return;
  await client.query('BEGIN');
  try {
    await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/b4-down-empty.sql'),'utf8'));
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  revertLocalMigrationHistory(url,history.rows[0].version);
}

export async function revertEmptyB5(client:Client,url:string) {
  // Preflight before removing ANY newer schema or repairing its history.
  const preflight=(await readFile(resolve(workspaceRoot,'infra/recovery/b5-down-empty.sql'),'utf8')).split('DROP TABLE sorteos.admin_actions;')[0]!;
  await client.query(preflight);
  const stage5=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name='ticket_recovery_stage5'");
  if(stage5.rows[0]){
    await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/stage5-down.sql'),'utf8'));
    revertLocalMigrationHistory(url,stage5.rows[0].version);
  }
  const stage4=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name='lottery_awards_stage4'");
  if(stage4.rows[0]){
    await client.query('BEGIN');
    try{await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/stage4-down-unused.sql'),'utf8'));await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK');throw error;}
    revertLocalMigrationHistory(url,stage4.rows[0].version);
  }
  const fixes=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name IN ('blessed_prize_lock_permission','blessed_prize_lock_policy') ORDER BY version DESC");
  for(const fix of fixes.rows)revertLocalMigrationHistory(url,fix.version);
  const stage3=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name='blessed_prizes_stage3'");
  if(stage3.rows[0]){
    await client.query('BEGIN');
    try{await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/stage3-down-unused.sql'),'utf8'));await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK');throw error;}
    revertLocalMigrationHistory(url,stage3.rows[0].version);
  }
  const stage2=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name='raffle_fundraising_stage2'");
  if(stage2.rows[0]){
    await client.query('BEGIN');
    try{await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/stage2-down-unused.sql'),'utf8'));await client.query('COMMIT');}
    catch(error){await client.query('ROLLBACK');throw error;}
    revertLocalMigrationHistory(url,stage2.rows[0].version);
  }
  const history=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name='admin_payments_b5'");
  if(!history.rows[0])return;
  await client.query('BEGIN');
  try{
    const m5=await client.query("SELECT version FROM supabase_migrations.schema_migrations WHERE name='operations_m5'");
    if(m5.rowCount)await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/m5-down-empty.sql'),'utf8'));
    await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/b5-down-empty.sql'),'utf8'));
    const m6=await client.query("SELECT version FROM supabase_migrations.schema_migrations WHERE name='http_rate_limits_m6'");
    if(m6.rowCount)await client.query(await readFile(resolve(workspaceRoot,'infra/recovery/m6-down.sql'),'utf8'));
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  const correction=await client.query<{version:string}>("SELECT version FROM supabase_migrations.schema_migrations WHERE name IN ('http_rate_limits_m6','operations_m5','admin_auth_session_checks','development_admin_access','development_demo_checkout') ORDER BY version DESC");
  for(const row of correction.rows)revertLocalMigrationHistory(url,row.version);
  revertLocalMigrationHistory(url,history.rows[0].version);
}
