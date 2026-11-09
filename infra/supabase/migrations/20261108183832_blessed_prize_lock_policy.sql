-- Row locking also requires an applicable UPDATE policy.
-- configuration_guard rejects every actual UPDATE; prizes remain immutable.
CREATE POLICY runtime_lock ON sorteos.raffle_prizes FOR UPDATE TO sorteos_runtime USING(true) WITH CHECK(true);
