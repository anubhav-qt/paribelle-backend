# Fix Vendor Users Script
# This script updates existing vendor users to link them with their vendors

$env:PGPASSWORD = "postgres"

Write-Host "Fixing vendor user accounts..." -ForegroundColor Cyan

# Path to PostgreSQL psql executable (adjust if needed)
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

if (-not (Test-Path $psqlPath)) {
    $psqlPath = "C:\Program Files\PostgreSQL\15\bin\psql.exe"
}

if (-not (Test-Path $psqlPath)) {
    Write-Host "Error: PostgreSQL psql not found. Please update the path in this script." -ForegroundColor Red
    exit 1
}

& $psqlPath -U postgres -d marketplace_db -f fix-vendor-users.sql

Write-Host "Vendor users fixed successfully!" -ForegroundColor Green
