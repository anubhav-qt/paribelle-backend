-- Add missing columns to invoice_items table
-- These columns are needed for product reference and better item tracking

-- Add product_id column if it doesn't exist
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

-- Add name column if it doesn't exist (for product/item name)
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

-- Add tax_amount column if it doesn't exist
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10, 2) DEFAULT 0;

-- Add tax_rate column if it doesn't exist
ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 2) DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);

-- Show the updated structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_items'
ORDER BY ordinal_position;
