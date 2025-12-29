-- Add KYC related columns to vendors table
-- This migration adds comprehensive KYC (Know Your Customer) fields for vendor verification

-- Add KYC status and documents
ALTER TABLE vendors 
  ADD COLUMN IF NOT EXISTS "kycStatus" VARCHAR(50) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "kycDocuments" JSONB,
  ADD COLUMN IF NOT EXISTS "kycSubmittedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "kycApprovedAt" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "kycApprovedBy" UUID,
  ADD COLUMN IF NOT EXISTS "kycRejectedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "panNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "gstRegistrationType" VARCHAR(50) DEFAULT 'unregistered',
  ADD COLUMN IF NOT EXISTS "gstState" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "invoiceFrequency" VARCHAR(50) DEFAULT 'per_order';

-- Create index for KYC status queries (for admin dashboard)
CREATE INDEX IF NOT EXISTS idx_vendors_kyc_status ON vendors("kycStatus");

-- Create index for invoice frequency (for cron job queries)
CREATE INDEX IF NOT EXISTS idx_vendors_invoice_frequency ON vendors("invoiceFrequency");

-- Add check constraint for KYC status
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_kyc_status'
  ) THEN
    ALTER TABLE vendors 
      ADD CONSTRAINT chk_kyc_status 
      CHECK ("kycStatus" IN ('pending', 'submitted', 'under_review', 'approved', 'rejected'));
  END IF;
END $$;

-- Add check constraint for GST registration type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_gst_registration_type'
  ) THEN
    ALTER TABLE vendors 
      ADD CONSTRAINT chk_gst_registration_type 
      CHECK ("gstRegistrationType" IN ('unregistered', 'regular', 'composition'));
  END IF;
END $$;

-- Add check constraint for invoice frequency
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_frequency'
  ) THEN
    ALTER TABLE vendors 
      ADD CONSTRAINT chk_invoice_frequency 
      CHECK ("invoiceFrequency" IN ('per_order', 'daily', 'weekly', 'monthly'));
  END IF;
END $$;

-- Add foreign key constraint for kycApprovedBy (references users table)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vendors_kyc_approved_by'
  ) THEN
    ALTER TABLE vendors 
      ADD CONSTRAINT fk_vendors_kyc_approved_by 
      FOREIGN KEY ("kycApprovedBy") REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN vendors."kycStatus" IS 'KYC verification status: pending (not submitted), submitted (awaiting review), under_review (admin reviewing), approved (verified), rejected (needs resubmission)';
COMMENT ON COLUMN vendors."kycDocuments" IS 'Array of KYC documents with structure: [{type, documentNumber, documentUrl, uploadedAt, fileName, fileSize}]';
COMMENT ON COLUMN vendors."kycSubmittedAt" IS 'Timestamp when vendor submitted KYC documents';
COMMENT ON COLUMN vendors."kycApprovedAt" IS 'Timestamp when admin approved KYC';
COMMENT ON COLUMN vendors."kycApprovedBy" IS 'User ID of admin who approved KYC';
COMMENT ON COLUMN vendors."kycRejectedReason" IS 'Reason for KYC rejection (shown to vendor for correction)';
COMMENT ON COLUMN vendors."panNumber" IS 'PAN card number for tax identification (format: XXXXX9999X)';
COMMENT ON COLUMN vendors."gstRegistrationType" IS 'GST registration type: unregistered (no GST), regular (normal GST registered), composition (composition scheme)';
COMMENT ON COLUMN vendors."gstState" IS 'State code extracted from GSTIN (first 2 digits, 01-37)';
COMMENT ON COLUMN vendors."invoiceFrequency" IS 'Invoice generation frequency: per_order (immediate), daily (end of day), weekly (Monday), monthly (1st of month)';

-- Update existing vendors to have default pending status
UPDATE vendors 
SET "kycStatus" = 'pending' 
WHERE "kycStatus" IS NULL;

-- Migration complete message
DO $$ 
BEGIN
  RAISE NOTICE 'Successfully added KYC fields to vendors table';
  RAISE NOTICE 'Vendors KYC status initialized to pending';
  RAISE NOTICE 'Invoice frequency initialized to per_order';
END $$;
