-- Reset Marketplace Database
-- Run this in pgAdmin Query Tool (connect to 'postgres' database)

-- Step 1: Terminate all connections to marketplace database
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'marketplace'
  AND pid <> pg_backend_pid();

-- Step 2: Drop the database
DROP DATABASE IF EXISTS marketplace;

-- Step 3: Create fresh database
CREATE DATABASE marketplace OWNER admin;
