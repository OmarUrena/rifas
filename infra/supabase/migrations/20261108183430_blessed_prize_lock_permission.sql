-- SELECT FOR UPDATE requires UPDATE privilege on at least one column.
-- Actual edits remain forbidden by configuration_guard for every UPDATE.
GRANT UPDATE(id) ON sorteos.raffle_prizes TO sorteos_runtime;
