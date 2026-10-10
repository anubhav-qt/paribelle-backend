-- Create Platform/Marketplace Vendor
-- This vendor will be used for products created by super admin

INSERT INTO vendors (
  id,
  "storeName",
  slug,
  description,
  "vendorType",
  status,
  "commissionRate",
  "shippingCost",
  "createdAt",
  "updatedAt"
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Special UUID for platform vendor
  'Marketplace',
  'marketplace-platform',
  'Official marketplace products managed by administrators',
  'business',
  'active',
  0.00, -- No commission for platform products
  0.00, -- Free shipping can be configured per product
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify the platform vendor was created
SELECT id, "storeName", slug, status FROM vendors WHERE id = '00000000-0000-0000-0000-000000000001';
