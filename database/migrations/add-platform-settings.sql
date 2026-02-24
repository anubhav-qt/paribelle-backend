-- Platform Settings Table for Super Admin KYC and Business Details
-- This stores the marketplace platform's own KYC, GST, and business information

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Business Information
    business_name VARCHAR(255) NOT NULL,
    business_legal_name VARCHAR(255) NOT NULL,
    business_type VARCHAR(50) NOT NULL, -- 'proprietorship', 'partnership', 'private_limited', 'llp', 'public_limited'
    business_email VARCHAR(255) NOT NULL,
    business_phone VARCHAR(20) NOT NULL,
    
    -- Registered Address
    registered_address_line1 VARCHAR(255) NOT NULL,
    registered_address_line2 VARCHAR(255),
    registered_city VARCHAR(100) NOT NULL,
    registered_state VARCHAR(100) NOT NULL,
    registered_pincode VARCHAR(10) NOT NULL,
    registered_country VARCHAR(100) NOT NULL DEFAULT 'India',
    
    -- Tax Information
    pan_number VARCHAR(10) UNIQUE,
    tan_number VARCHAR(10),
    gst_registration_type VARCHAR(20) CHECK (gst_registration_type IN ('unregistered', 'regular', 'composition')),
    gstin VARCHAR(15) UNIQUE,
    gst_state VARCHAR(100),
    gst_registration_date DATE,
    
    -- Bank Details for Commission Collection
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_ifsc_code VARCHAR(11),
    bank_account_holder_name VARCHAR(255),
    bank_branch VARCHAR(255),
    
    -- KYC Documents (stored as JSONB array)
    kyc_documents JSONB DEFAULT '[]',
    
    -- Platform Commission Settings
    default_commission_percentage DECIMAL(5,2) DEFAULT 10.00,
    
    -- Contact Person
    contact_person_name VARCHAR(255),
    contact_person_designation VARCHAR(100),
    contact_person_email VARCHAR(255),
    contact_person_phone VARCHAR(20),
    
    -- KYC Status
    kyc_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'incomplete', 'complete', 'needs_update')),
    kyc_completed_at TIMESTAMP WITH TIME ZONE,
    kyc_updated_by UUID REFERENCES users(id),
    
    -- Metadata
    settings_updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settings_updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on GSTIN for quick lookups
CREATE INDEX IF NOT EXISTS idx_platform_settings_gstin ON platform_settings(gstin);
CREATE INDEX IF NOT EXISTS idx_platform_settings_kyc_status ON platform_settings(kyc_status);

-- Ensure only one row exists (singleton pattern)
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_settings_singleton ON platform_settings((1));

-- Insert default platform settings row
INSERT INTO platform_settings (
    business_name, 
    business_legal_name, 
    business_type,
    business_email,
    business_phone,
    registered_address_line1,
    registered_city,
    registered_state,
    registered_pincode,
    kyc_status
) VALUES (
    'My Marketplace',
    'My Marketplace Private Limited',
    'private_limited',
    'ajaniljoshijobs@gmail.com',
    '1800-XXX-XXXX',
    'Office Address Line 1',
    'Mumbai',
    'Maharashtra',
    '400001',
    'incomplete'
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE platform_settings IS 'Stores the marketplace platform owner (super admin) KYC and business details for GST filing';
COMMENT ON COLUMN platform_settings.kyc_documents IS 'JSON array of documents: PAN, GST Certificate, TAN, Business Registration, Bank Statement, Address Proof, etc.';
COMMENT ON COLUMN platform_settings.default_commission_percentage IS 'Default commission percentage charged from vendors';
