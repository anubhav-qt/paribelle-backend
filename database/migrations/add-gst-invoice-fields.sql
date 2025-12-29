-- Add invoice frequency and GST fields
-- This migration adds invoice frequency to vendors and GST configuration to products

-- Add invoice frequency to vendors table
ALTER TABLE vendors 
  ADD COLUMN IF NOT EXISTS "invoiceFrequency" VARCHAR(50) DEFAULT 'per_order';

-- Add check constraint for invoice frequency
ALTER TABLE vendors 
  DROP CONSTRAINT IF EXISTS chk_invoice_frequency;

ALTER TABLE vendors 
  ADD CONSTRAINT chk_invoice_frequency 
  CHECK ("invoiceFrequency" IN ('per_order', 'daily', 'weekly', 'monthly'));

-- Add GST and pricing fields to products table
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS "hsnCode" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "sacCode" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "gstRate" DECIMAL(5, 2) DEFAULT 18.00,
  ADD COLUMN IF NOT EXISTS "priceType" VARCHAR(50) DEFAULT 'selling_price_without_gst',
  ADD COLUMN IF NOT EXISTS "mrp" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "basePrice" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "gstAmount" DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS "hasVariants" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "variantOptions" JSONB;

-- Add check constraint for GST rate (Indian GST slabs)
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS chk_gst_rate;

ALTER TABLE products 
  ADD CONSTRAINT chk_gst_rate 
  CHECK ("gstRate" IN (0, 5, 12, 18, 28));

-- Add check constraint for price type
ALTER TABLE products 
  DROP CONSTRAINT IF EXISTS chk_price_type;

ALTER TABLE products 
  ADD CONSTRAINT chk_price_type 
  CHECK ("priceType" IN ('mrp_with_gst', 'selling_price_without_gst'));

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products("hsnCode");
CREATE INDEX IF NOT EXISTS idx_products_gst_rate ON products("gstRate");
CREATE INDEX IF NOT EXISTS idx_vendors_invoice_frequency ON vendors("invoiceFrequency");

-- Create product variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "productId" UUID REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(255) UNIQUE NOT NULL,
    "variantAttributes" JSONB NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    "stockQuantity" INTEGER DEFAULT 0,
    images TEXT[],
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for product variants
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants("productId");
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(sku);
CREATE INDEX IF NOT EXISTS idx_product_variants_active ON product_variants("isActive");

-- Create HSN codes master table
CREATE TABLE IF NOT EXISTS hsn_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    "recommendedGstRate" DECIMAL(5, 2) NOT NULL,
    category VARCHAR(100),
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add index for HSN codes
CREATE INDEX IF NOT EXISTS idx_hsn_codes_code ON hsn_codes(code);
CREATE INDEX IF NOT EXISTS idx_hsn_codes_category ON hsn_codes(category);

-- Insert common HSN codes for Indian marketplace
INSERT INTO hsn_codes (code, description, "recommendedGstRate", category) VALUES
    -- Apparel & Fashion
    ('6109', 'T-shirts, singlets and other vests, knitted or crocheted', 5, 'Apparel'),
    ('6203', 'Men''s or boys'' suits, ensembles, jackets, blazers, trousers', 12, 'Apparel'),
    ('6204', 'Women''s or girls'' suits, ensembles, jackets, dresses, skirts', 12, 'Apparel'),
    ('6211', 'Track suits, ski suits and swimwear', 12, 'Apparel'),
    
    -- Footwear
    ('6403', 'Footwear with outer soles of rubber, plastics, leather', 18, 'Footwear'),
    ('6404', 'Footwear with outer soles of rubber or plastics and uppers of textile', 12, 'Footwear'),
    
    -- Electronics
    ('8517', 'Telephone sets, smartphones, cellular network apparatus', 18, 'Electronics'),
    ('8528', 'Monitors, projectors, televisions, reception apparatus', 18, 'Electronics'),
    ('8471', 'Laptops, computers, automatic data processing machines', 18, 'Electronics'),
    ('8518', 'Microphones, loudspeakers, headphones, audio amplifiers', 18, 'Electronics'),
    
    -- Cosmetics & Personal Care
    ('3304', 'Beauty or make-up preparations, skin care products', 18, 'Cosmetics'),
    ('3305', 'Hair care preparations, shampoos, hair oils', 18, 'Cosmetics'),
    ('3401', 'Soap, washing preparations, cleaning products', 18, 'Personal Care'),
    
    -- Books & Education
    ('4901', 'Printed books, brochures, leaflets and similar printed matter', 0, 'Books'),
    ('4902', 'Newspapers, journals and periodicals', 0, 'Books'),
    
    -- Food Items
    ('0401', 'Milk and cream, not concentrated nor sweetened', 0, 'Food'),
    ('1001', 'Wheat and meslin', 0, 'Food'),
    ('1006', 'Rice', 0, 'Food'),
    ('1701', 'Cane or beet sugar and chemically pure sucrose', 5, 'Food'),
    ('1905', 'Bread, pastry, cakes, biscuits and other bakers'' wares', 18, 'Food'),
    ('2106', 'Food preparations not elsewhere specified or included', 12, 'Food'),
    ('2202', 'Waters, including mineral and aerated, sweetened beverages', 12, 'Beverages'),
    
    -- Healthcare & Medicines
    ('3004', 'Medicaments (excluding goods of heading 30.02, 30.05 or 30.06)', 5, 'Healthcare'),
    ('9021', 'Orthopaedic appliances, hearing aids, artificial body parts', 5, 'Healthcare'),
    
    -- Furniture & Home
    ('9403', 'Other furniture and parts thereof', 18, 'Furniture'),
    ('9404', 'Mattress supports, mattresses, cushions and similar stuffed furnishings', 18, 'Furniture'),
    ('6302', 'Bed linen, table linen, toilet linen and kitchen linen', 5, 'Home Textiles'),
    
    -- Toys & Sports
    ('9503', 'Tricycles, scooters, pedal cars, dolls, toys', 12, 'Toys'),
    ('9506', 'Articles and equipment for general physical exercise, gymnastics', 18, 'Sports'),
    
    -- Jewelry & Accessories
    ('7113', 'Articles of jewellery and parts thereof', 3, 'Jewelry'),
    ('7117', 'Imitation jewellery', 18, 'Fashion Accessories'),
    
    -- Automobiles & Parts
    ('8703', 'Motor cars and other motor vehicles principally for transport', 28, 'Automobiles'),
    ('8711', 'Motorcycles and cycles fitted with an auxiliary motor', 28, 'Automobiles'),
    ('8708', 'Parts and accessories of motor vehicles', 28, 'Auto Parts'),
    
    -- Tobacco Products
    ('2402', 'Cigars, cheroots, cigarillos and cigarettes', 28, 'Tobacco'),
    ('2403', 'Other manufactured tobacco and manufactured tobacco substitutes', 28, 'Tobacco'),
    
    -- Home Appliances
    ('8516', 'Electric instantaneous or storage water heaters, immersion heaters', 18, 'Appliances'),
    ('8509', 'Electro-mechanical domestic appliances with self-contained motor', 18, 'Appliances')
ON CONFLICT (code) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN vendors."invoiceFrequency" IS 'Invoice generation frequency: per_order, daily, weekly, monthly';
COMMENT ON COLUMN products."hsnCode" IS 'HSN (Harmonized System of Nomenclature) code for goods classification';
COMMENT ON COLUMN products."sacCode" IS 'SAC (Services Accounting Code) for services';
COMMENT ON COLUMN products."gstRate" IS 'GST rate percentage: 0, 5, 12, 18, or 28';
COMMENT ON COLUMN products."priceType" IS 'Price type: mrp_with_gst or selling_price_without_gst';
COMMENT ON COLUMN products."mrp" IS 'Maximum Retail Price (if priceType is mrp_with_gst)';
COMMENT ON COLUMN products."basePrice" IS 'Price before GST calculation';
COMMENT ON COLUMN products."gstAmount" IS 'Calculated GST amount';
COMMENT ON COLUMN products."hasVariants" IS 'Whether product has variants (size, color, etc.)';
COMMENT ON COLUMN products."variantOptions" IS 'Variant configuration: {size: ["S","M","L"], color: ["Red","Blue"]}';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully added GST and invoice frequency fields';
  RAISE NOTICE 'Added % HSN codes to master table', (SELECT COUNT(*) FROM hsn_codes);
END $$;
