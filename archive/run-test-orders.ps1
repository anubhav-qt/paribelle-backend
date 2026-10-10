#!/usr/bin/env pwsh
# Script to run the test orders SQL script

Write-Host "Creating test orders for aniljoshi2..." -ForegroundColor Cyan

# Get database connection details from .env file
$envPath = Join-Path $PSScriptRoot ".env"
if (Test-Path $envPath) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DB_NAME = if ($env:DB_NAME) { $env:DB_NAME } else { "marketplace_db" }
$DB_USER = if ($env:DB_USER) { $env:DB_USER } else { "postgres" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "postgres" }

Write-Host "Connecting to database: ${DB_NAME}@${DB_HOST}:${DB_PORT}" -ForegroundColor Yellow

$env:PGPASSWORD = $DB_PASSWORD

$sqlFile = Join-Path $PSScriptRoot "create-test-orders.sql"

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $sqlFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Test orders created successfully!" -ForegroundColor Green
    Write-Host "`nCreated orders:" -ForegroundColor Cyan
    Write-Host "  1. ORDER RECEIVED: A customer bought from aniljoshi2's store" -ForegroundColor White
    Write-Host "  2. ORDER PLACED: aniljoshi2 bought from another vendor" -ForegroundColor White
    Write-Host "`nRefresh the vendor orders page to see the changes." -ForegroundColor Yellow
} else {
    Write-Host "`n✗ Failed to create test orders" -ForegroundColor Red
    exit 1
}
