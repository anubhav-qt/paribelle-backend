-- Add categoryDisplayMode column to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS "categoryDisplayMode" VARCHAR(10) DEFAULT 'sidebar';

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length, column_default
FROM information_schema.columns
WHERE table_name = 'vendors' AND column_name = 'categoryDisplayMode';
