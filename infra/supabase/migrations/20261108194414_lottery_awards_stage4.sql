-- Lottery prizes have their own units; blessed prize units cannot be consumed here.
CREATE TABLE sorteos.lottery_prizes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raffle_id uuid NOT NULL REFERENCES sorteos.raffles(id),
 title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 180),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,raffle_id)
);
CREATE TABLE sorteos.lottery_results (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raffle_id uuid NOT NULL REFERENCES sorteos.raffles(id),
 pick4 text NOT NULL CHECK(pick4 ~ '^[0-9]{4}$'), fireball text NOT NULL CHECK(fireball ~ '^[0-9]$'),
 number text GENERATED ALWAYS AS (pick4||fireball) STORED,
 event_at timestamptz NOT NULL, reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 1 AND 1000),
 rules_version text NOT NULL, sales_closed boolean NOT NULL,
 eligible_order_id uuid, created_by uuid NOT NULL REFERENCES sorteos.admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(id,raffle_id),
 FOREIGN KEY(eligible_order_id,raffle_id) REFERENCES sorteos.orders(id,raffle_id)
);
CREATE TABLE sorteos.lottery_awards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), raffle_id uuid NOT NULL,
 result_id uuid NOT NULL, prize_id uuid NOT NULL UNIQUE, order_id uuid NOT NULL,
 prize_snapshot text NOT NULL, created_by uuid NOT NULL REFERENCES sorteos.admin_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(result_id,raffle_id) REFERENCES sorteos.lottery_results(id,raffle_id),
 FOREIGN KEY(prize_id,raffle_id) REFERENCES sorteos.lottery_prizes(id,raffle_id),
 FOREIGN KEY(order_id,raffle_id) REFERENCES sorteos.orders(id,raffle_id), UNIQUE(result_id,prize_id)
);
CREATE TABLE sorteos.prize_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lottery_award_id uuid UNIQUE REFERENCES sorteos.lottery_awards(id),
 blessed_award_id uuid UNIQUE REFERENCES sorteos.blessed_awards(id),
 delivered_at timestamptz NOT NULL, reference text NOT NULL CHECK(length(btrim(reference)) BETWEEN 1 AND 1000),
 created_by uuid NOT NULL REFERENCES sorteos.admin_users(id), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(lottery_award_id,blessed_award_id)=1)
);
CREATE INDEX lottery_prizes_raffle ON sorteos.lottery_prizes(raffle_id);
CREATE INDEX lottery_results_raffle ON sorteos.lottery_results(raffle_id,created_at DESC,id);
CREATE INDEX lottery_awards_raffle ON sorteos.lottery_awards(raffle_id,created_at DESC,id);
CREATE INDEX lottery_awards_order ON sorteos.lottery_awards(order_id);
CREATE INDEX lottery_results_order ON sorteos.lottery_results(eligible_order_id);

CREATE FUNCTION sorteos.guard_lottery_write() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r sorteos.raffles; result sorteos.lottery_results; target uuid; oid uuid; expected text;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Historial de premios inmutable' USING ERRCODE='23514'; END IF;
 PERFORM sorteos.assert_financial_admin();
 IF NOT EXISTS(SELECT 1 FROM sorteos.admin_users WHERE id=nullif(current_setting('app.actor_id',true),'')::uuid AND role='OWNER' AND active) THEN
 RAISE EXCEPTION 'Requiere propietario' USING ERRCODE='42501'; END IF;
 IF TG_TABLE_NAME='prize_deliveries' THEN
  IF NEW.lottery_award_id IS NOT NULL THEN SELECT raffle_id,order_id INTO STRICT target,oid FROM sorteos.lottery_awards WHERE id=NEW.lottery_award_id;
  ELSE SELECT raffle_id,order_id INTO STRICT target,oid FROM sorteos.blessed_awards WHERE id=NEW.blessed_award_id AND status='CONFIRMED'; END IF;
 ELSE target:=NEW.raffle_id; END IF;
 SELECT * INTO STRICT r FROM sorteos.raffles WHERE id=target FOR UPDATE;
 IF TG_TABLE_NAME='lottery_prizes' THEN
  IF r.status<>'DRAFT' OR r.published_at IS NOT NULL OR EXISTS(SELECT 1 FROM sorteos.checkout_holds WHERE raffle_id=r.id) THEN
   RAISE EXCEPTION 'Premios antes de publicar' USING ERRCODE='23514'; END IF;
 ELSIF TG_TABLE_NAME='lottery_results' THEN
  NEW.created_by:=nullif(current_setting('app.actor_id',true),'')::uuid;
  NEW.sales_closed:=(r.status='CLOSED' AND r.updated_at<=NEW.event_at); NEW.rules_version:=r.rules_version;
  IF NEW.event_at>now() THEN RAISE EXCEPTION 'Evento futuro' USING ERRCODE='23514'; END IF;
  -- Eligibility frozen at registration, only closed sales and already paid tickets.
  SELECT o.id INTO NEW.eligible_order_id FROM sorteos.tickets t JOIN sorteos.orders o ON o.id=t.current_order_id
   WHERE t.raffle_id=r.id AND t.number=(NEW.pick4||NEW.fireball)::integer AND t.status='SOLD' AND o.status='PAID'
    AND o.created_at<=NEW.event_at AND o.reviewed_at<=NEW.event_at AND NEW.sales_closed;
 ELSIF TG_TABLE_NAME='lottery_awards' THEN
  SELECT * INTO STRICT result FROM sorteos.lottery_results WHERE id=NEW.result_id AND raffle_id=r.id;
  IF r.status<>'CLOSED' OR NOT result.sales_closed OR result.rules_version<>r.rules_version
   OR result.eligible_order_id IS DISTINCT FROM NEW.order_id
   OR EXISTS(SELECT 1 FROM sorteos.orders WHERE raffle_id=r.id AND status NOT IN ('PAID','CANCELLED'))
   OR EXISTS(SELECT 1 FROM sorteos.checkout_holds WHERE raffle_id=r.id AND status='ACTIVE' AND expires_at>now()) THEN
   RAISE EXCEPTION 'Resultado sin elegibilidad definitiva' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS(SELECT 1 FROM sorteos.orders o JOIN sorteos.tickets t ON t.current_order_id=o.id
    WHERE o.id=NEW.order_id AND o.status='PAID' AND t.status='SOLD' AND t.raffle_id=r.id AND t.number=result.number::integer) THEN
   RAISE EXCEPTION 'Boleto no pagado' USING ERRCODE='23514'; END IF;
  SELECT title INTO STRICT expected FROM sorteos.lottery_prizes WHERE id=NEW.prize_id AND raffle_id=r.id;
  NEW.prize_snapshot:=expected; NEW.created_by:=nullif(current_setting('app.actor_id',true),'')::uuid;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM sorteos.orders WHERE id=oid AND status='PAID') OR NEW.delivered_at>now()
    OR (NEW.lottery_award_id IS NOT NULL AND NEW.delivered_at<(SELECT created_at FROM sorteos.lottery_awards WHERE id=NEW.lottery_award_id))
    OR (NEW.blessed_award_id IS NOT NULL AND NEW.delivered_at<(SELECT updated_at FROM sorteos.blessed_awards WHERE id=NEW.blessed_award_id)) THEN
   RAISE EXCEPTION 'Entrega no elegible' USING ERRCODE='23514'; END IF;
  NEW.created_by:=nullif(current_setting('app.actor_id',true),'')::uuid;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE t text; role_name text; BEGIN
 FOREACH t IN ARRAY ARRAY['lottery_prizes','lottery_results','lottery_awards','prize_deliveries'] LOOP
  EXECUTE format('ALTER TABLE sorteos.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON sorteos.%I FROM PUBLIC',t);
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON sorteos.%I FROM %I',t,role_name); END IF;
  END LOOP;
  EXECUTE format('GRANT SELECT,INSERT ON sorteos.%I TO sorteos_runtime',t);
  EXECUTE format('CREATE POLICY runtime_read ON sorteos.%I FOR SELECT TO sorteos_runtime USING(true)',t);
  EXECUTE format('CREATE POLICY runtime_insert ON sorteos.%I FOR INSERT TO sorteos_runtime WITH CHECK(true)',t);
  EXECUTE format('CREATE TRIGGER guard BEFORE INSERT OR UPDATE ON sorteos.%I FOR EACH ROW EXECUTE FUNCTION sorteos.guard_lottery_write()',t);
  EXECUTE format('CREATE TRIGGER audit AFTER INSERT ON sorteos.%I FOR EACH ROW EXECUTE FUNCTION sorteos.audit_write()',t);
  EXECUTE format('CREATE TRIGGER preserve_history BEFORE DELETE OR TRUNCATE ON sorteos.%I FOR EACH STATEMENT EXECUTE FUNCTION sorteos.reject_delete()',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION sorteos.guard_lottery_write() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sorteos.guard_lottery_write() TO sorteos_runtime;
CREATE UNIQUE INDEX lottery_action_idempotency ON sorteos.audit_logs(actor_id,(metadata->>'idempotencyKey')) WHERE action='LOTTERY_ACTION';

CREATE FUNCTION sorteos.guard_delivered_order() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND EXISTS(
  SELECT 1 FROM sorteos.prize_deliveries d LEFT JOIN sorteos.lottery_awards a ON a.id=d.lottery_award_id
  LEFT JOIN sorteos.blessed_awards b ON b.id=d.blessed_award_id WHERE coalesce(a.order_id,b.order_id)=OLD.id) THEN
  RAISE EXCEPTION 'Premio entregado requiere procedimiento excepcional' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sorteos.guard_delivered_order() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sorteos.guard_delivered_order() TO sorteos_runtime;
CREATE TRIGGER delivered_order_guard BEFORE UPDATE ON sorteos.orders FOR EACH ROW EXECUTE FUNCTION sorteos.guard_delivered_order();
