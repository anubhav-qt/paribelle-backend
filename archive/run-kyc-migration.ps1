# Run KYC Migration Script
# This script applies the vendor KYC fields migration to the database

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  Vendor KYC Migration Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-Not (Test-Path ".env")) {
    Write-Host "Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with database connection details." -ForegroundColor Yellow
    exit 1
}

# Load environment variables
Get-Content ".env" | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        [Environment]::SetEnvironmentVariable($key, $value, "Process")
    }
}

$DB_HOST = $env:DB_HOST
$DB_PORT = $env:DB_PORT
$DB_NAME = $env:DB_NAME
$DB_USER = $env:DB_USER
$DB_PASSWORD = $env:DB_PASSWORD

Write-Host "Database Configuration:" -ForegroundColor Green
Write-Host "  Host: $DB_HOST" -ForegroundColor Gray
Write-Host "  Port: $DB_PORT" -ForegroundColor Gray
Write-Host "  Database: $DB_NAME" -ForegroundColor Gray
Write-Host "  User: $DB_USER" -ForegroundColor Gray
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-Not $psqlPath) {
    Write-Host "Error: PostgreSQL client (psql) not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL or add it to your PATH." -ForegroundColor Yellow
    exit 1
}

# Migration file path
$migrationFile = "database/migrations/add-vendor-kyc.sql"

if (-Not (Test-Path $migrationFile)) {
    Write-Host "Error: Migration file not found: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "Running migration: add-vendor-kyc.sql" -ForegroundColor Yellow
Write-Host ""

# Set PGPASSWORD environment variable for password authentication
$env:PGPASSWORD = $DB_PASSWORD

# Run the migration
try {
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $migrationFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "====================================" -ForegroundColor Green
        Write-Host "  Migration completed successfully!" -ForegroundColor Green
        Write-Host "====================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "KYC fields added to vendors table:" -ForegroundColor Cyan
        Write-Host "  - kycStatus" -ForegroundColor Gray
        Write-Host "  - kycDocuments" -ForegroundColor Gray
        Write-Host "  - kycSubmittedAt" -ForegroundColor Gray
        Write-Host "  - kycApprovedAt" -ForegroundColor Gray
        Write-Host "  - kycApprovedBy" -ForegroundColor Gray
        Write-Host "  - kycRejectedReason" -ForegroundColor Gray
        Write-Host "  - panNumber" -ForegroundColor Gray
        Write-Host "  - gstRegistrationType" -ForegroundColor Gray
        Write-Host "  - gstState" -ForegroundColor Gray
        Write-Host "  - invoiceFrequency" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Restart your backend server" -ForegroundColor Gray
        Write-Host "  2. Test KYC upload at /vendor/kyc" -ForegroundColor Gray
        Write-Host "  3. Test admin verification at /admin/kyc-verification" -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "Error: Migration failed!" -ForegroundColor Red
        Write-Host "Please check the error messages above." -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host ""
    Write-Host "Error executing migration: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host ""
