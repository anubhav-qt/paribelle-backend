# Update vendor subdomains in the database
$env:PGPASSWORD = "postgres"

Write-Host "Checking current vendor subdomains..." -ForegroundColor Cyan

# Check current state
psql -h localhost -U postgres -d marketplace -c "SELECT id, `"storeName`", `"businessName`", subdomain FROM vendors LIMIT 5;"

Write-Host "`nUpdating vendor subdomains..." -ForegroundColor Yellow

# Update vendors to have subdomains
psql -h localhost -U postgres -d marketplace -c "UPDATE vendors SET subdomain = LOWER(REPLACE(slug, ' ', '-')) WHERE subdomain IS NULL AND slug IS NOT NULL;"

psql -h localhost -U postgres -d marketplace -c "UPDATE vendors SET subdomain = LOWER(REPLACE(REPLACE(`"storeName`", ' ', '-'), '''', '')) WHERE subdomain IS NULL;"

Write-Host "`nVerifying updates..." -ForegroundColor Green

# Verify
psql -h localhost -U postgres -d marketplace -c "SELECT id, `"storeName`", `"businessName`", subdomain, status FROM vendors;"

Write-Host "`nDone! All vendors now have subdomains set." -ForegroundColor Green
