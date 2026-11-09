-- Only for unused configuration; never discard prize or beneficiary history.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM sorteos.raffle_prizes) OR EXISTS(SELECT 1 FROM sorteos.blessed_numbers)
 OR EXISTS(SELECT 1 FROM sorteos.blessed_awards) THEN
 RAISE EXCEPTION 'Rollback etapa 3 bloqueado: conservar premios e historico'; END IF;
END $$;
DROP TRIGGER blessed_consistency ON sorteos.orders;
DROP TABLE sorteos.blessed_awards;
DROP TABLE sorteos.blessed_numbers;
DROP TABLE sorteos.raffle_prizes;
DROP FUNCTION sorteos.validate_blessed_commit(),sorteos.guard_blessed_award(),sorteos.guard_prize_configuration();
DROP INDEX sorteos.prize_action_idempotency;
