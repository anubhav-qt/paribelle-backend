-- Add attributes column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS attributes jsonb;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_attributes ON products USING gin (attributes);
