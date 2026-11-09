-- Immutable configuration, attached to a logical number, never pre-created tickets.
CREATE TABLE sorteos.raffle_prizes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES sorteos.raffles(id),
  title text NOT NULL CHECK(length(btrim(title)) BETWEEN 1 AND 180),
  description text NOT NULL CHECK(length(description)<=2000),
  kind text NOT NULL CHECK(kind IN ('MONEY','ITEM','OTHER')),
  amount_minor sorteos.positive_minor,
  quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id,raffle_id),
  CHECK((kind='MONEY')=(amount_minor IS NOT NULL))
);
CREATE INDEX raffle_prizes_raffle ON sorteos.raffle_prizes(raffle_id,created_at,id);
CREATE TABLE sorteos.blessed_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES sorteos.raffles(id),
  number integer NOT NULL CHECK(number BETWEEN 0 AND 99999),
  prize_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(raffle_id,number),UNIQUE(id,raffle_id),
  FOREIGN KEY(prize_id,raffle_id) REFERENCES sorteos.raffle_prizes(id,raffle_id)
);
CREATE INDEX blessed_numbers_prize ON sorteos.blessed_numbers(prize_id);
CREATE TABLE sorteos.blessed_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL,
  blessing_id uuid NOT NULL,
  order_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  prize_snapshot jsonb NOT NULL CHECK(jsonb_typeof(prize_snapshot)='object'),
  status text NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK(status IN ('PENDING_PAYMENT','CONFIRMED','VOIDED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(blessing_id,raffle_id) REFERENCES sorteos.blessed_numbers(id,raffle_id),
  FOREIGN KEY(order_id,raffle_id) REFERENCES sorteos.orders(id,raffle_id),
  FOREIGN KEY(ticket_id,raffle_id) REFERENCES sorteos.tickets(id,raffle_id),
  FOREIGN KEY(order_id,ticket_id) REFERENCES sorteos.order_tickets(order_id,ticket_id),
  UNIQUE(order_id,blessing_id)
);
CREATE UNIQUE INDEX blessed_award_active ON sorteos.blessed_awards(blessing_id) WHERE status<>'VOIDED';
CREATE INDEX blessed_awards_raffle ON sorteos.blessed_awards(raffle_id,created_at DESC,id);
CREATE INDEX blessed_awards_ticket ON sorteos.blessed_awards(ticket_id);

CREATE FUNCTION sorteos.guard_prize_configuration() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r sorteos.raffles; p sorteos.raffle_prizes;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Configuracion de premios inmutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT r FROM sorteos.raffles WHERE id=NEW.raffle_id FOR UPDATE;
  IF r.status<>'DRAFT' OR r.published_at IS NOT NULL OR EXISTS(SELECT 1 FROM sorteos.checkout_holds WHERE raffle_id=r.id) THEN
    RAISE EXCEPTION 'Configurar premios antes de publicar y comprometer boletos' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM sorteos.admin_users WHERE id=nullif(current_setting('app.actor_id',true),'')::uuid AND role='OWNER' AND active) THEN
    RAISE EXCEPTION 'Premios requieren propietario' USING ERRCODE='42501';
  END IF;
  IF TG_TABLE_NAME='blessed_numbers' THEN
    IF NEW.number>=r.total_tickets THEN RAISE EXCEPTION 'Bendecido fuera del rango' USING ERRCODE='23514'; END IF;
    SELECT * INTO STRICT p FROM sorteos.raffle_prizes WHERE id=NEW.prize_id AND raffle_id=r.id FOR UPDATE;
    IF (SELECT count(*) FROM sorteos.blessed_numbers WHERE prize_id=p.id)>=p.quantity THEN
      RAISE EXCEPTION 'Sin unidades de premio disponibles' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION sorteos.guard_blessed_award() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE o sorteos.orders; b sorteos.blessed_numbers; p sorteos.raffle_prizes; expected jsonb;
BEGIN
  PERFORM 1 FROM sorteos.raffles WHERE id=NEW.raffle_id FOR UPDATE;
  SELECT * INTO STRICT o FROM sorteos.orders WHERE id=NEW.order_id;
  SELECT * INTO STRICT b FROM sorteos.blessed_numbers WHERE id=NEW.blessing_id;
  SELECT * INTO STRICT p FROM sorteos.raffle_prizes WHERE id=b.prize_id;
  expected:=jsonb_build_object('title',p.title,'description',p.description,'kind',p.kind,'amountMinor',p.amount_minor);
  IF NEW.prize_snapshot IS DISTINCT FROM expected OR NOT EXISTS(
    SELECT 1 FROM sorteos.tickets WHERE id=NEW.ticket_id AND raffle_id=NEW.raffle_id AND number=b.number) THEN
    RAISE EXCEPTION 'Premio o numero incompatible' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'PENDING_PAYMENT' OR o.status NOT IN ('PENDING_REVIEW','UNDER_REVIEW','NEEDS_RESOLUTION') THEN
      RAISE EXCEPTION 'Adjudicacion inicial pendiente' USING ERRCODE='23514';
    END IF;
  ELSE
    IF (NEW.id,NEW.raffle_id,NEW.blessing_id,NEW.order_id,NEW.ticket_id,NEW.prize_snapshot,NEW.created_at)
      IS DISTINCT FROM (OLD.id,OLD.raffle_id,OLD.blessing_id,OLD.order_id,OLD.ticket_id,OLD.prize_snapshot,OLD.created_at)
      OR OLD.status<>'PENDING_PAYMENT' OR NOT (
        (NEW.status='CONFIRMED' AND o.status='PAID') OR (NEW.status='VOIDED' AND o.status='CANCELLED')) THEN
      RAISE EXCEPTION 'Transicion de premio invalida' USING ERRCODE='23514';
    END IF;
    NEW.updated_at:=now();
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION sorteos.validate_blessed_commit() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE target uuid; o sorteos.orders; wanted text;
BEGIN
  IF TG_TABLE_NAME='orders' THEN target:=NEW.id; ELSE target:=NEW.order_id; END IF;
  SELECT * INTO STRICT o FROM sorteos.orders WHERE id=target;
  wanted:=CASE WHEN o.status='PAID' THEN 'CONFIRMED' WHEN o.status='CANCELLED' THEN 'VOIDED' ELSE 'PENDING_PAYMENT' END;
  IF EXISTS(SELECT 1 FROM sorteos.blessed_awards WHERE order_id=o.id AND status<>wanted)
    OR EXISTS(SELECT 1 FROM sorteos.order_tickets ot JOIN sorteos.tickets t ON t.id=ot.ticket_id
      JOIN sorteos.blessed_numbers b ON b.raffle_id=t.raffle_id AND b.number=t.number
      WHERE ot.order_id=o.id AND NOT EXISTS(SELECT 1 FROM sorteos.blessed_awards a
        WHERE a.order_id=o.id AND a.blessing_id=b.id AND a.ticket_id=t.id AND a.status=wanted)) THEN
    RAISE EXCEPTION 'Adjudicacion y pago inconsistentes' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;

DO $$ DECLARE t text; r text; BEGIN
  FOREACH t IN ARRAY ARRAY['raffle_prizes','blessed_numbers','blessed_awards'] LOOP
    EXECUTE format('ALTER TABLE sorteos.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON sorteos.%I FROM PUBLIC',t);
    FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON sorteos.%I FROM %I',t,r); END IF;
    END LOOP;
    EXECUTE format('GRANT SELECT,INSERT ON sorteos.%I TO sorteos_runtime',t);
    EXECUTE format('CREATE POLICY runtime_read ON sorteos.%I FOR SELECT TO sorteos_runtime USING(true)',t);
    EXECUTE format('CREATE POLICY runtime_insert ON sorteos.%I FOR INSERT TO sorteos_runtime WITH CHECK(true)',t);
    EXECUTE format('CREATE TRIGGER audit AFTER INSERT OR UPDATE ON sorteos.%I FOR EACH ROW EXECUTE FUNCTION sorteos.audit_write()',t);
    EXECUTE format('CREATE TRIGGER preserve_history BEFORE DELETE OR TRUNCATE ON sorteos.%I FOR EACH STATEMENT EXECUTE FUNCTION sorteos.reject_delete()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['raffle_prizes','blessed_numbers'] LOOP
    EXECUTE format('CREATE TRIGGER configuration_guard BEFORE INSERT OR UPDATE ON sorteos.%I FOR EACH ROW EXECUTE FUNCTION sorteos.guard_prize_configuration()',t);
  END LOOP;
END $$;
GRANT UPDATE(status,updated_at) ON sorteos.blessed_awards TO sorteos_runtime;
CREATE POLICY runtime_update ON sorteos.blessed_awards FOR UPDATE TO sorteos_runtime USING(true) WITH CHECK(true);
CREATE TRIGGER award_guard BEFORE INSERT OR UPDATE ON sorteos.blessed_awards FOR EACH ROW EXECUTE FUNCTION sorteos.guard_blessed_award();
CREATE CONSTRAINT TRIGGER blessed_consistency AFTER INSERT OR UPDATE ON sorteos.orders
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sorteos.validate_blessed_commit();
CREATE CONSTRAINT TRIGGER blessed_consistency AFTER INSERT OR UPDATE ON sorteos.blessed_awards
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sorteos.validate_blessed_commit();
REVOKE ALL ON FUNCTION sorteos.guard_prize_configuration(),sorteos.guard_blessed_award(),sorteos.validate_blessed_commit() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sorteos.guard_prize_configuration(),sorteos.guard_blessed_award(),sorteos.validate_blessed_commit() TO sorteos_runtime;
CREATE UNIQUE INDEX prize_action_idempotency ON sorteos.audit_logs(actor_id,(metadata->>'idempotencyKey'))
WHERE action IN ('PRIZE_CREATED','BLESSED_NUMBERS_CREATED');
