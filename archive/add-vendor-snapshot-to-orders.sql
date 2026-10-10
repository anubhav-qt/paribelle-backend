-- Add vendor snapshot columns to orders table
-- This ensures invoices show vendor information as it was at time of purchase

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS vendor_business_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS vendor_store_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS vendor_gst_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS vendor_address TEXT,
ADD COLUMN IF NOT EXISTS vendor_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS vendor_state VARCHAR(100),
ADD COLUMN IF NOT EXISTS vendor_postal_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS vendor_country VARCHAR(100),
ADD COLUMN IF NOT EXISTS vendor_contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS vendor_contact_phone VARCHAR(20);

-- Backfill existing orders with current vendor information
UPDATE orders o
SET 
    vendor_business_name = v.business_name,
    vendor_store_name = v.store_name,
    vendor_gst_number = v.gst_number,
    vendor_address = v.address,
    vendor_city = v.city,
    vendor_state = v.state,
    vendor_postal_code = v.postal_code,
    vendor_country = v.country,
    vendor_contact_email = v.contact_email,
    vendor_contact_phone = v.contact_phone
FROM vendors v
WHERE o.vendor_id = v.id
  AND o.vendor_business_name IS NULL;

-- Show results
SELECT 
    order_number,
    vendor_store_name,
    vendor_gst_number,
    vendor_city
FROM orders 
WHERE vendor_id IS NOT NULL
LIMIT 10;
