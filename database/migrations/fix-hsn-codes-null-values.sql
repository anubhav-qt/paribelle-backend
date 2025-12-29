-- Fix HSN codes table - remove rows with null codes and ensure proper schema

-- Delete any rows with null code values
DELETE FROM hsn_codes WHERE code IS NULL;

-- If the code column is not unique, make it unique
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'UQ_hsn_codes_code'
    ) THEN
        ALTER TABLE hsn_codes ADD CONSTRAINT UQ_hsn_codes_code UNIQUE (code);
    END IF;
END $$;

-- Ensure code column is NOT NULL (should already be from migration)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'hsn_codes' 
        AND column_name = 'code' 
        AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE hsn_codes ALTER COLUMN code SET NOT NULL;
    END IF;
END $$;
