-- Verify all entity column names match database schema
-- Run with: psql -U admin -d marketplace -f scripts/verify-schema.sql

\echo '=== Checking critical tables for camelCase columns ==='

-- Check vendors table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'vendors' 
  AND column_name ~ '[A-Z]'
ORDER BY column_name;

-- Check products table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'products' 
  AND column_name ~ '[A-Z]'
ORDER BY column_name;

-- Check product_variants table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'product_variants' 
  AND column_name ~ '[A-Z]'
ORDER BY column_name;

-- Check users table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND column_name ~ '[A-Z]'
ORDER BY column_name;

-- Check orders table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name ~ '[A-Z]'
ORDER BY column_name;

\echo '=== If any columns appear above, they need snake_case mapping in entities ==='

-- List all snake_case columns for reference
\echo '=== All columns in key tables (should all be snake_case) ==='
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('vendors', 'products', 'product_variants', 'users', 'orders')
ORDER BY table_name, ordinal_position;
