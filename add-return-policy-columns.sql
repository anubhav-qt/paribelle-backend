-- Add return policy columns to vendors table
ALTER TABLE vendors 
ADD COLUMN IF NOT EXISTS return_policy_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS allow_returns BOOLEAN DEFAULT true;

COMMENT ON COLUMN vendors.return_policy_days IS 'Number of days after delivery for returns (0 = no returns)';
COMMENT ON COLUMN vendors.allow_returns IS 'Whether this vendor accepts returns';

-- Add return policy columns to platform_settings table
ALTER TABLE platform_settings 
ADD COLUMN IF NOT EXISTS default_return_policy_days INTEGER DEFAULT 7,
ADD COLUMN IF NOT EXISTS allow_vendor_custom_return_policy BOOLEAN DEFAULT true;

COMMENT ON COLUMN platform_settings.default_return_policy_days IS 'Default number of days after delivery for returns';
COMMENT ON COLUMN platform_settings.allow_vendor_custom_return_policy IS 'Allow vendors to set their own return policies';

-- Update existing vendors to have the default policy
UPDATE vendors 
SET return_policy_days = 7, allow_returns = true 
WHERE return_policy_days IS NULL OR allow_returns IS NULL;

-- Update existing platform settings
UPDATE platform_settings 
SET default_return_policy_days = 7, allow_vendor_custom_return_policy = true 
WHERE default_return_policy_days IS NULL OR allow_vendor_custom_return_policy IS NULL;
