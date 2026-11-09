-- Stage 5 revised by owner: public, masked phone summary. No OTP or session.
CREATE TABLE sorteos.ticket_lookup_limits (
  key text PRIMARY KEY CHECK(key ~ '^(ip|phone):[a-f0-9]{64}$'),
  attempts integer NOT NULL CHECK(attempts>0),
  window_started_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_lookup_limits_cleanup ON sorteos.ticket_lookup_limits(window_started_at);
ALTER TABLE sorteos.ticket_lookup_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sorteos.ticket_lookup_limits FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON sorteos.ticket_lookup_limits FROM %I',r);
    END IF;
  END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON sorteos.ticket_lookup_limits TO sorteos_runtime;
CREATE POLICY runtime_read ON sorteos.ticket_lookup_limits FOR SELECT TO sorteos_runtime USING(true);
CREATE POLICY runtime_insert ON sorteos.ticket_lookup_limits FOR INSERT TO sorteos_runtime WITH CHECK(true);
CREATE POLICY runtime_update ON sorteos.ticket_lookup_limits FOR UPDATE TO sorteos_runtime USING(true) WITH CHECK(true);
CREATE POLICY runtime_cleanup ON sorteos.ticket_lookup_limits FOR DELETE TO sorteos_runtime USING(true);
-- Exact normalization matches existing checkout records; no historical data rewrite.
CREATE INDEX customers_lookup_phone ON sorteos.customers
  ((regexp_replace(btrim(phone),'[[:space:]().-]','','g')));
CREATE INDEX orders_lookup_customer_raffle ON sorteos.orders(customer_id,raffle_id)
  INCLUDE(ticket_quantity) WHERE status<>'CANCELLED';
