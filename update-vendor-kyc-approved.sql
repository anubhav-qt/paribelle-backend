-- Update all existing vendors to have KYC status approved
-- This is for development/testing purposes

UPDATE vendors 
SET kyc_status = 'approved' 
WHERE kyc_status != 'approved';

-- Show results
SELECT id, store_name, business_name, kyc_status 
FROM vendors;
