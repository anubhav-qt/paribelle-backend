-- Grant necessary permissions to admin user
-- IMPORTANT: Run this in pgAdmin as the 'postgres' superuser
-- Connect to the 'marketplace' database first, then run this query

-- Fix PostgreSQL 15+ public schema permissions issue
ALTER SCHEMA public OWNER TO admin;

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE marketplace TO admin;

-- Grant all privileges on schema public
GRANT ALL ON SCHEMA public TO admin;

-- Grant create privilege on schema
GRANT CREATE ON SCHEMA public TO admin;

-- Grant all privileges on all tables (for future tables)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO admin;

-- Grant all on existing tables (if any)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;

-- Verify permissions
SELECT 
    nspname AS schema_name,
    nspowner::regrole AS owner
FROM pg_namespace 
WHERE nspname = 'public';
