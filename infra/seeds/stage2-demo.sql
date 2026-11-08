-- Optional fixture, only for an isolated DEMO database after stage 2 migrations.
-- Defines a range; creates zero ticket rows. No bank account, customer or sale.
SELECT set_config('app.actor_kind','SEED',true);
SELECT set_config('app.request_id','00000000-0000-4000-8000-000000000802',true);
INSERT INTO sorteos.raffles(id,slug,title,description,prize,total_tickets,ticket_price_minor,
  min_purchase,max_purchase,rules,rules_version,fundraising_target_minor)
VALUES('00000000-0000-4000-8000-000000000802','demo-rango-cinco-cifras',
  'RIFA DEMO — RANGO VIRTUAL','Sin venta, premio o transferencia real.',
  'PREMIO DEMO SIN VALOR COMERCIAL',100000,10000,1,20,
  'SOLO DEMOSTRACIÓN. NO TRANSFERIR DINERO.','DEMO-STAGE2-1',1000000)
ON CONFLICT(id) DO NOTHING;
