-- Fix vendor admin users that don't have vendorId set
-- This links users with role 'vendor_admin' to their corresponding vendor records

UPDATE users 
SET vendor_id = vendors.id
FROM vendors
WHERE users.id = vendors.user_id
  AND users.role = 'vendor_admin'
  AND users.vendor_id IS NULL;

-- Verify the fix
SELECT 
  u.id as user_id,
  u.email,
  u.role,
  u.vendor_id,
  v.id as vendor_id_from_vendors,
  v.store_name
FROM users u
LEFT JOIN vendors v ON u.id = v.user_id
WHERE u.role = 'vendor_admin'
ORDER BY u.created_at DESC;
