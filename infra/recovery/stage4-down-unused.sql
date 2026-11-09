DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM sorteos.lottery_prizes) OR EXISTS(SELECT 1 FROM sorteos.lottery_results)
 OR EXISTS(SELECT 1 FROM sorteos.lottery_awards) OR EXISTS(SELECT 1 FROM sorteos.prize_deliveries)
 THEN RAISE EXCEPTION 'Rollback etapa 4 bloqueado: conservar historico'; END IF;
END $$;
DROP TRIGGER delivered_order_guard ON sorteos.orders;
DROP FUNCTION sorteos.guard_delivered_order();
DROP TABLE sorteos.prize_deliveries,sorteos.lottery_awards,sorteos.lottery_results,sorteos.lottery_prizes;
DROP FUNCTION sorteos.guard_lottery_write();
DROP INDEX sorteos.lottery_action_idempotency;
