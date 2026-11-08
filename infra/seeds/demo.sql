-- Solo fixture DEMO: no contiene cuenta bancaria real ni privilegios de admin activos.
SELECT set_config('app.actor_kind', 'SEED', true);
SELECT set_config('app.request_id', '00000000-0000-4000-8000-000000000001', true);

INSERT INTO sorteos.admin_users(id, auth_user_id, role, active)
VALUES ('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000011','OWNER',false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sorteos.raffles(inventory_policy,id, slug, title, description, prize, total_tickets, ticket_price_minor,
  min_purchase, max_purchase, rules, rules_version) VALUES ('LEGACY','00000000-0000-4000-8000-000000000100','demo-b1-100', 'RIFA DEMO B1 — NO ES UNA OFERTA REAL',
  'Fixture de desarrollo sin ventas ni sorteo real.', 'PREMIO DEMO SIN VALOR COMERCIAL',
  100, 10025, 1, 20, 'Solo demostración; no transferir dinero.', 'DEMO-1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sorteos.bank_accounts(id, bank_name, holder_name, account_type, account_display, is_demo)
VALUES ('00000000-0000-4000-8000-000000000200','BANCO DEMO — NO EXISTE','TITULAR DEMO — NO REAL',
  'DEMO','SIN CUENTA REAL — NO TRANSFERIR',true) ON CONFLICT (id) DO NOTHING;

INSERT INTO sorteos.customers(id, name, phone, email, is_demo)
VALUES ('00000000-0000-4000-8000-000000000300','CLIENTE DEMO — NO REAL','+18095550100',
  'cliente-demo@example.invalid',true) ON CONFLICT (id) DO NOTHING;

INSERT INTO sorteos.guest_sessions(id, secret_hash, expires_at)
VALUES ('00000000-0000-4000-8000-000000000400',repeat('0',64), now() + interval '1 day')
ON CONFLICT (id) DO NOTHING;

-- No reejecutar mutaciones de inventario cuando el fixture ya existe.
DO $$
DECLARE h uuid := '00000000-0000-4000-8000-000000000500';
  o uuid := '00000000-0000-4000-8000-000000000600';
BEGIN
  IF EXISTS (SELECT 1 FROM sorteos.orders WHERE id = o) THEN RETURN; END IF;
  PERFORM 1 FROM sorteos.raffles WHERE id = '00000000-0000-4000-8000-000000000100' FOR UPDATE;
  INSERT INTO sorteos.checkout_holds(id, raffle_id, session_id, quantity, unit_price_minor_snapshot,
    rules_version_snapshot, expires_at, idempotency_key, request_hash)
  VALUES (h,'00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000400',
    3,10025,'DEMO-1',now() + interval '1 hour','00000000-0000-4000-8000-000000000501',repeat('1',64));
  -- Números deterministas exclusivamente para fixture SQL, nunca para compras reales.
  UPDATE sorteos.tickets SET status = 'HELD', hold_id = h
  WHERE raffle_id = '00000000-0000-4000-8000-000000000100' AND number IN (0,1,2);
  INSERT INTO sorteos.orders(id, order_code, raffle_id, customer_id, session_id, hold_id,
    ticket_quantity, unit_price_minor, rules_version_snapshot, lookup_secret_hash, idempotency_key, request_hash)
  VALUES (o,'RF-DEMO000000000001','00000000-0000-4000-8000-000000000100',
    '00000000-0000-4000-8000-000000000300','00000000-0000-4000-8000-000000000400',h,
    3,10025,'DEMO-1',repeat('2',64),'00000000-0000-4000-8000-000000000601',repeat('3',64));
  INSERT INTO sorteos.order_tickets(order_id, ticket_id, raffle_id)
  SELECT o,id,raffle_id FROM sorteos.tickets WHERE hold_id = h;
  INSERT INTO sorteos.payment_reports(id, order_id, bank_account_id, reference, transfer_date,
    receipt_storage_path, receipt_sha256)
  VALUES ('00000000-0000-4000-8000-000000000700',o,'00000000-0000-4000-8000-000000000200',
    'REFERENCIA DEMO SIN TRANSFERENCIA REAL',now(),'receipts/demo/comprobante-simulado.pdf',repeat('4',64));
  UPDATE sorteos.tickets SET status = 'RESERVED', hold_id = NULL, current_order_id = o WHERE hold_id = h;
  UPDATE sorteos.checkout_holds SET status = 'CONSUMED' WHERE id = h;
END $$;
