-- Migration: Add billing contact fields to orders table
-- Date: 2024
-- Description: Adds billing_name, billing_email, and billing_phone fields to orders table

-- Add billing name field
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS billing_name VARCHAR(255);

-- Add billing email field
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255);

-- Add billing phone field
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(20);

-- For existing orders, copy shipping contact info to billing contact info
UPDATE orders 
SET 
  billing_name = shipping_name,
  billing_email = shipping_email,
  billing_phone = shipping_phone
WHERE 
  billing_name IS NULL;

-- Add comment to table for documentation
COMMENT ON COLUMN orders.billing_name IS 'Full name for billing address';
COMMENT ON COLUMN orders.billing_email IS 'Email for billing address';
COMMENT ON COLUMN orders.billing_phone IS 'Phone for billing address';
