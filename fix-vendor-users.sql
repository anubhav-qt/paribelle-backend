-- Fix vendorId for existing vendor users
-- This script links vendor users to their vendors

UPDATE users u
SET "vendorId" = v.id
FROM vendors v
WHERE u.id = v."userId"
  AND u.role = 'vendor_admin'
  AND u."vendorId" IS NULL;

-- Verify the update
SELECT 
  u.email,
  u.role,
  u."vendorId",
  v."storeName"
FROM users u
LEFT JOIN vendors v ON u."vendorId" = v.id
WHERE u.role = 'vendor_admin';
