-- Complete Admin User Fix for Neon Database
-- Run this in Neon SQL Editor

-- Step 1: Check if user exists
SELECT 
    id,
    email,
    first_name,
    last_name,
    role,
    status,
    email_verified_at,
    substring(password, 1, 20) || '...' as password_preview
FROM users 
WHERE email = 'anubhav.s.joshi@gmail.com';

-- Step 2: If user doesn't exist, create it
-- (Run this only if Step 1 returns no results)
INSERT INTO users (
    email,
    password,
    first_name,
    last_name,
    role,
    status,
    email_verified_at,
    created_at,
    updated_at
) 
SELECT 
    'anubhav.s.joshi@gmail.com',
    '$2b$10$Ff4ljOeD9ePZyMLKpy2m/.eeWVdMKt3kgmEahW/yJK8SkDfhvdkDS', -- Admin@123
    'Admin',
    'User',
    'super_admin',
    'active',
    NOW(),
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'anubhav.s.joshi@gmail.com'
);

-- Step 3: If user exists but needs fixing, update it
UPDATE users 
SET 
    password = '$2b$10$Ff4ljOeD9ePZyMLKpy2m/.eeWVdMKt3kgmEahW/yJK8SkDfhvdkDS', -- Admin@123
    email_verified_at = COALESCE(email_verified_at, NOW()),
    status = 'active',
    role = 'super_admin',
    first_name = 'Admin',
    last_name = 'User',
    updated_at = NOW()
WHERE email = 'anubhav.s.joshi@gmail.com';

-- Step 4: Verify the fix
SELECT 
    id,
    email,
    first_name || ' ' || last_name as name,
    role,
    status,
    CASE 
        WHEN email_verified_at IS NULL THEN '❌ NOT VERIFIED'
        ELSE '✅ VERIFIED at ' || email_verified_at::text
    END as verification_status,
    substring(password, 1, 30) || '...' as password_hash,
    created_at,
    updated_at
FROM users 
WHERE email = 'anubhav.s.joshi@gmail.com';

-- RESULT:
-- After running the above queries, you should be able to login with:
-- Email: anubhav.s.joshi@gmail.com
-- Password: Admin@123
