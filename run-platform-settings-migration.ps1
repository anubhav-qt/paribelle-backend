# PowerShell script to run platform settings migration
# This creates the platform_settings table for super admin KYC

Write-Host "Running Platform Settings Migration..." -ForegroundColor Cyan

# Database connection details from .env
$DB_HOST = "localhost"
$DB_PORT = "5432"
$DB_NAME = "marketplace"
$DB_USER = "postgres"

# Set PostgreSQL password environment variable
$env:PGPASSWORD = "postgres"

# Run the migration
Write-Host "Executing SQL migration file..." -ForegroundColor Yellow

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "database/migrations/add-platform-settings.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Platform settings migration completed successfully!" -ForegroundColor Green
    Write-Host "  - Created platform_settings table" -ForegroundColor Green
    Write-Host "  - Added indexes for GSTIN and KYC status" -ForegroundColor Green
    Write-Host "  - Inserted default platform settings row" -ForegroundColor Green
} else {
    Write-Host "`n✗ Migration failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Verify the table was created
Write-Host "`nVerifying platform_settings table..." -ForegroundColor Yellow
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "\d platform_settings"

Write-Host "`nQuerying default platform settings..." -ForegroundColor Yellow
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT id, business_name, kyc_status, created_at FROM platform_settings;"

Write-Host "`nDone! You can now configure platform KYC from super admin dashboard." -ForegroundColor Cyan
