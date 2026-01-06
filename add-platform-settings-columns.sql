-- Add missing columns to platform_settings table

ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS business_phone VARCHAR(20);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS business_email VARCHAR(255);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS gstin VARCHAR(15);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS registered_address_line1 VARCHAR(255);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS registered_city VARCHAR(100);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS registered_state VARCHAR(100);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS registered_pincode VARCHAR(10);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS registered_country VARCHAR(100);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS kyc_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS kyc_updated_by UUID REFERENCES users(id);
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS settings_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE platform_settings ADD COLUMN IF NOT EXISTS settings_updated_by UUID REFERENCES users(id);

-- Create index for foreign keys
CREATE INDEX IF NOT EXISTS idx_platform_settings_kyc_updated_by ON platform_settings(kyc_updated_by);
CREATE INDEX IF NOT EXISTS idx_platform_settings_settings_updated_by ON platform_settings(settings_updated_by);
