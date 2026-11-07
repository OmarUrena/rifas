-- Only disposable HTTP budgets; never removes orders, audit, Auth or payments.
-- Stop API traffic before applying. Repair only the M6 version with the official CLI.
-- A live rollback must keep memory mode restricted to development/test.
DROP TABLE sorteos.http_rate_limits;
