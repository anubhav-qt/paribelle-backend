-- Script to create test orders for aniljoshi2
-- 1 order received (customer buying aniljoshi2's product)
-- 1 order placed (aniljoshi2 buying from another vendor)

-- Known values
-- aniljoshi2 userId: 5f8d46be-af82-432f-bd3c-a0e87b48ade7
-- aniljoshi2 vendorId: 6b70bb00-4f1e-4908-8cdf-9b5ae5bb07e7

-- Step 1: Create a test customer user (or get existing)
INSERT INTO users (id, email, password, phone, first_name, last_name, role, is_email_verified, email_verification_token, email_verification_expires, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'testcustomer@marketplace.com',
  '$2a$10$X1QJ9Z8KqZ7YxY0qZ7YxY0qZ7YxY0qZ7YxY0qZ7YxY0qZ7YxY0', -- dummy hash
  '1234567890',
  'Test',
  'Customer',
  'customer',
  true,
  NULL,
  NULL,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Get the test customer ID
DO $$
DECLARE
  test_customer_id UUID;
  aniljoshi2_user_id UUID := '5f8d46be-af82-432f-bd3c-a0e87b48ade7';
  aniljoshi2_vendor_id UUID := '6b70bb00-4f1e-4908-8cdf-9b5ae5bb07e7';
  aniljoshi2_product_id UUID;
  other_vendor_product_id UUID;
  order_received_id UUID;
  order_placed_id UUID;
  order_received_number VARCHAR;
  order_placed_number VARCHAR;
BEGIN
  -- Get test customer ID
  SELECT id INTO test_customer_id FROM users WHERE email = 'testcustomer@marketplace.com';
  
  -- Get a product from aniljoshi2's vendor
  SELECT id INTO aniljoshi2_product_id 
  FROM products 
  WHERE vendor_id = aniljoshi2_vendor_id 
  AND status = 'active'
  LIMIT 1;
  
  -- Get a product from another vendor
  SELECT id INTO other_vendor_product_id 
  FROM products 
  WHERE vendor_id != aniljoshi2_vendor_id 
  AND status = 'active'
  LIMIT 1;
  
  -- Generate order numbers
  order_received_number := 'ORD' || EXTRACT(EPOCH FROM NOW())::BIGINT || '001';
  order_placed_number := 'ORD' || EXTRACT(EPOCH FROM NOW())::BIGINT || '002';
  
  -- Create ORDER RECEIVED: Test customer buys from aniljoshi2's store
  IF aniljoshi2_product_id IS NOT NULL THEN
    order_received_id := gen_random_uuid();
    
    INSERT INTO orders (
      id, user_id, order_number, status, payment_status, payment_method,
      subtotal, discount, tax, shipping_cost, total,
      shipping_address, billing_address, notes,
      created_at, updated_at
    ) VALUES (
      order_received_id,
      test_customer_id, -- Customer is placing the order
      order_received_number,
      'pending',
      'pending',
      'cod',
      100.00,
      0.00,
      18.00,
      50.00,
      168.00,
      '{"name": "Test Customer", "phone": "1234567890", "address": "123 Test St", "city": "Test City", "state": "Test State", "pincode": "123456"}'::jsonb,
      '{"name": "Test Customer", "phone": "1234567890", "address": "123 Test St", "city": "Test City", "state": "Test State", "pincode": "123456"}'::jsonb,
      'Test order - Order Received by aniljoshi2',
      NOW(),
      NOW()
    );
    
    -- Add order item
    INSERT INTO order_items (
      id, order_id, product_id, vendor_id, quantity, price, discount, tax, subtotal, total,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      order_received_id,
      aniljoshi2_product_id, -- Product from aniljoshi2's store
      aniljoshi2_vendor_id,
      1,
      100.00,
      0.00,
      18.00,
      100.00,
      118.00,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created ORDER RECEIVED: % (Customer: %, Product from aniljoshi2)', order_received_number, test_customer_id;
  ELSE
    RAISE NOTICE 'No active product found for aniljoshi2 vendor';
  END IF;
  
  -- Create ORDER PLACED: aniljoshi2 buys from another vendor
  IF other_vendor_product_id IS NOT NULL THEN
    order_placed_id := gen_random_uuid();
    
    INSERT INTO orders (
      id, user_id, order_number, status, payment_status, payment_method,
      subtotal, discount, tax, shipping_cost, total,
      shipping_address, billing_address, notes,
      created_at, updated_at
    ) VALUES (
      order_placed_id,
      aniljoshi2_user_id, -- aniljoshi2 is placing the order
      order_placed_number,
      'pending',
      'pending',
      'cod',
      150.00,
      0.00,
      27.00,
      50.00,
      227.00,
      '{"name": "Anil Joshi2", "phone": "09876543212", "address": "654", "city": "645", "state": "654", "pincode": "645646"}'::jsonb,
      '{"name": "Anil Joshi2", "phone": "09876543212", "address": "654", "city": "645", "state": "654", "pincode": "645646"}'::jsonb,
      'Test order - Order Placed by aniljoshi2',
      NOW(),
      NOW()
    );
    
    -- Add order item
    INSERT INTO order_items (
      id, order_id, product_id, vendor_id, quantity, price, discount, tax, subtotal, total,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      order_placed_id,
      other_vendor_product_id, -- Product from another vendor
      (SELECT vendor_id FROM products WHERE id = other_vendor_product_id),
      1,
      150.00,
      0.00,
      27.00,
      150.00,
      177.00,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Created ORDER PLACED: % (Buyer: aniljoshi2, Product from another vendor)', order_placed_number;
  ELSE
    RAISE NOTICE 'No active product found from other vendors';
  END IF;
  
  RAISE NOTICE 'Test customer ID: %', test_customer_id;
  RAISE NOTICE 'aniljoshi2 product ID: %', aniljoshi2_product_id;
  RAISE NOTICE 'Other vendor product ID: %', other_vendor_product_id;
END $$;
