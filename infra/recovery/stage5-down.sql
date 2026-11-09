-- No accounting/domain data are deleted. Only ephemeral abuse counters are lost.
-- Disable the lookup route before rollback; it then returns LOOKUP_UNAVAILABLE.
DROP INDEX IF EXISTS sorteos.orders_lookup_customer_raffle;
DROP INDEX IF EXISTS sorteos.customers_lookup_phone;
DROP TABLE IF EXISTS sorteos.ticket_lookup_limits;
