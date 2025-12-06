-- Add heroBanners column to vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS "heroBanners" jsonb;

-- Add comment for documentation
COMMENT ON COLUMN vendors."heroBanners" IS 'Array of hero banner configurations for vendor store pages';
