-- First, check current vendor data
SELECT id, "storeName", "businessName", subdomain, status 
FROM vendors 
LIMIT 10;

-- Update vendors to have subdomains based on their slug or store name
UPDATE vendors 
SET subdomain = LOWER(REPLACE(slug, ' ', '-'))
WHERE subdomain IS NULL AND slug IS NOT NULL;

-- For vendors without slugs, use storeName
UPDATE vendors 
SET subdomain = LOWER(REPLACE(REPLACE("storeName", ' ', '-'), '''', ''))
WHERE subdomain IS NULL;

-- Verify the update
SELECT id, "storeName", "businessName", subdomain, status 
FROM vendors;
