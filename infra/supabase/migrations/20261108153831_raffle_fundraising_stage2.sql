-- Existing universes remain immutable. New production inserts use FIVE_DIGIT.
ALTER TABLE sorteos.raffles
  ADD COLUMN inventory_policy text NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN fundraising_target_minor sorteos.positive_minor;
ALTER TABLE sorteos.raffles ALTER COLUMN inventory_policy SET DEFAULT 'FIVE_DIGIT';
ALTER TABLE sorteos.raffles ADD CONSTRAINT raffle_inventory_policy
  CHECK (inventory_policy IN ('LEGACY','FIVE_DIGIT') AND (inventory_policy='LEGACY' OR total_tickets=100000));

CREATE OR REPLACE FUNCTION sorteos.guard_raffle() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  -- Never enable a draw transition. An already drawn historical row can change its goal.
  IF NEW.status='DRAWN' AND (TG_OP='INSERT' OR OLD.status<>'DRAWN') THEN
    RAISE EXCEPTION 'Sorteo no habilitado' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.id<>OLD.id OR NEW.total_tickets<>OLD.total_tickets THEN
      RAISE EXCEPTION 'Numeracion inmutable; crear otra rifa' USING ERRCODE='23514';
    END IF;
    IF NEW.ticket_price_minor<>OLD.ticket_price_minor AND EXISTS(SELECT 1 FROM sorteos.checkout_holds WHERE raffle_id=OLD.id) THEN
      RAISE EXCEPTION 'Precio comprometido' USING ERRCODE='23514';
    END IF;
    NEW.updated_at:=now();
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION sorteos.guard_raffle_stage2() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF current_user='sorteos_runtime' AND NEW.inventory_policy<>'FIVE_DIGIT' THEN
      RAISE EXCEPTION 'Nuevas rifas requieren universo de cinco cifras' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NEW.inventory_policy<>OLD.inventory_policy THEN
      RAISE EXCEPTION 'Politica de inventario inmutable' USING ERRCODE='23514';
    END IF;
    IF NEW.fundraising_target_minor IS DISTINCT FROM OLD.fundraising_target_minor THEN
      IF NEW.fundraising_target_minor IS NULL OR NOT EXISTS (
        SELECT 1 FROM sorteos.admin_users WHERE id=nullif(current_setting('app.actor_id',true),'')::uuid
        AND active AND role='OWNER') OR nullif(current_setting('app.target_change_reason',true),'') IS NULL THEN
        RAISE EXCEPTION 'Objetivo requiere propietario y motivo' USING ERRCODE='23514';
      END IF;
    END IF;
  END IF;
  IF NEW.status='PUBLISHED' AND NEW.inventory_policy='FIVE_DIGIT' AND NEW.fundraising_target_minor IS NULL THEN
    RAISE EXCEPTION 'Publicacion requiere objetivo' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION sorteos.guard_raffle_stage2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sorteos.guard_raffle_stage2() TO sorteos_runtime;
CREATE TRIGGER raffle_stage2 BEFORE INSERT OR UPDATE ON sorteos.raffles
FOR EACH ROW EXECUTE FUNCTION sorteos.guard_raffle_stage2();

-- No table or PII added; immutable audit doubles as the retry record.
CREATE UNIQUE INDEX target_change_idempotency ON sorteos.audit_logs(actor_id,(metadata->>'idempotencyKey'))
WHERE action='FUNDRAISING_TARGET_CHANGED';
CREATE INDEX orders_paid_raffle ON sorteos.orders(raffle_id) INCLUDE(total_minor) WHERE status='PAID';

-- LEGACY fixtures retain historical rows; FIVE_DIGIT uses only an implicit range.
CREATE OR REPLACE FUNCTION sorteos.populate_tickets() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.inventory_policy='LEGACY' THEN
    INSERT INTO sorteos.tickets(raffle_id,number) SELECT NEW.id,n FROM generate_series(0,NEW.total_tickets-1) n;
  END IF;
  RETURN NEW;
END $$;
