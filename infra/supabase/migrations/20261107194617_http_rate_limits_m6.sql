-- Disposable HTTP budgets, separate from business/audit history. No IP or token.
CREATE TABLE sorteos.http_rate_limits (
  key text PRIMARY KEY CHECK (key ~ '^[0-9a-f]{64}$'),
  hits integer NOT NULL CHECK (hits BETWEEN 1 AND 10001),
  expires_at timestamptz NOT NULL,
  blocked_until timestamptz NOT NULL DEFAULT 'epoch'
);
CREATE INDEX http_rate_limits_expiry ON sorteos.http_rate_limits(expires_at);
ALTER TABLE sorteos.http_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sorteos.http_rate_limits FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON sorteos.http_rate_limits FROM %I',r);
    END IF;
  END LOOP;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON sorteos.http_rate_limits TO sorteos_runtime;
CREATE POLICY runtime_http_limits ON sorteos.http_rate_limits TO sorteos_runtime
  USING(true) WITH CHECK(true);
