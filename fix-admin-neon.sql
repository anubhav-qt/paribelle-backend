-- Neon SQL Editor Query: Check and Fix Admin Login
-- Copy and paste this into Neon Console SQL Editor

-- 1. Check current admin user status
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    status,
    email_verified_at,
    LEFT(password, 20) || '...' as password_hash,
    length(password) as password_length
FROM users 
WHERE email = 'admin@marketplace.com';

-- 2. If email_verified_at is NULL or status is wrong, run this to fix it:
UPDATE users 
SET 
    email_verified_at = CASE WHEN email_verified_at IS NULL THEN NOW() ELSE email_verified_at END,
    status = 'active'
WHERE email = 'admin@marketplace.com';

-- 3. Reset password to 'admin123' with correct bcrypt hash:
UPDATE users 
SET password = '$2b$10$XL/tvIca6p0z4qrffpKEi.cwdG9SC75skOQGqrM7Y6pr7FA0hGimS'
WHERE email = 'admin@marketplace.com';

-- 4. Verify the fix
SELECT 
    email,
    first_name || ' ' || last_name as name,
    role,
    status,
    CASE 
        WHEN email_verified_at IS NULL THEN '❌ NOT VERIFIED'
        ELSE '✅ VERIFIED'
    END as email_status
FROM users 
WHERE email = 'admin@marketplace.com';

-- SUMMARY:
-- After running the UPDATE queries above, login should work with:
-- Email: admin@marketplace.com
-- Password: admin123
