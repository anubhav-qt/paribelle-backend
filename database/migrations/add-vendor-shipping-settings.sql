-- Add shipping settings to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS "freeShippingThreshold" DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(10,2) DEFAULT 50.00;

-- Update existing vendors with default shipping cost
UPDATE vendors SET "shippingCost" = 50.00 WHERE "shippingCost" IS NULL;
