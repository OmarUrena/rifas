-- Run transactionally only on isolated/authorized databases. Never discard target history.
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM sorteos.raffles WHERE inventory_policy='FIVE_DIGIT' OR fundraising_target_minor IS NOT NULL)
    OR EXISTS(SELECT 1 FROM sorteos.audit_logs WHERE action='FUNDRAISING_TARGET_CHANGED') THEN
    RAISE EXCEPTION 'Stage 2 in use: recover forwards; no destructive rollback';
  END IF;
END $$;
DROP TRIGGER raffle_stage2 ON sorteos.raffles;
DROP FUNCTION sorteos.guard_raffle_stage2();
DROP INDEX sorteos.target_change_idempotency;
DROP INDEX sorteos.orders_paid_raffle;
ALTER TABLE sorteos.raffles DROP CONSTRAINT raffle_inventory_policy,
  DROP COLUMN fundraising_target_minor,DROP COLUMN inventory_policy;
CREATE OR REPLACE FUNCTION sorteos.guard_raffle() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.status='DRAWN' THEN RAISE EXCEPTION 'Sorteo no habilitado' USING ERRCODE='23514'; END IF;
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

CREATE OR REPLACE FUNCTION sorteos.populate_tickets() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  INSERT INTO sorteos.tickets(raffle_id,number) SELECT NEW.id,n FROM generate_series(0,NEW.total_tickets-1) n;
  RETURN NEW;
END $$;
