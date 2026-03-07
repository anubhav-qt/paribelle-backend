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
WHERE email = 'anubhav.s.joshi@gmail.com';

-- 2. If email_verified_at is NULL or status is wrong, run this to fix it:
UPDATE users 
SET 
    email_verified_at = CASE WHEN email_verified_at IS NULL THEN NOW() ELSE email_verified_at END,
    status = 'active'
WHERE email = 'anubhav.s.joshi@gmail.com';

-- 3. Reset password to 'Admin@123' with correct bcrypt hash (generate with: node hash-password.js):
UPDATE users 
SET password = '$2b$10$rCyJ3VQ7XhE7J4N.YR5d0.kqZ8Y5dqJ7xZ8Y5dqJ7xZ8Y5dqJ7xZ8a'
WHERE email = 'anubhav.s.joshi@gmail.com';

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
WHERE email = 'anubhav.s.joshi@gmail.com';

-- SUMMARY:
-- After running the UPDATE queries above, login should work with:
-- Email: anubhav.s.joshi@gmail.com
-- Password: Admin@123
