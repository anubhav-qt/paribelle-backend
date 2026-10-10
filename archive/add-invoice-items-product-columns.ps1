#!/usr/bin/env pwsh

Write-Host "🔧 Adding missing columns to invoice_items table..." -ForegroundColor Cyan

# Database connection details
$DB_HOST = if ($env:DB_HOST) { $env:DB_HOST } else { "localhost" }
$DB_PORT = if ($env:DB_PORT) { $env:DB_PORT } else { "5432" }
$DB_USER = if ($env:DB_USERNAME) { $env:DB_USERNAME } else { "admin" }
$DB_PASSWORD = if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "admin" }
$DB_NAME = if ($env:DB_DATABASE) { $env:DB_DATABASE } else { "marketplace" }

# Set password environment variable
$env:PGPASSWORD = $DB_PASSWORD

# Get the script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "add-invoice-items-product-columns.sql"

Write-Host "📁 SQL File: $sqlFile" -ForegroundColor Gray
Write-Host "🗄️  Database: $DB_NAME on $DB_HOST`:$DB_PORT" -ForegroundColor Gray
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "❌ psql command not found!" -ForegroundColor Red
    Write-Host "   Please install PostgreSQL client tools or add them to PATH" -ForegroundColor Yellow
    exit 1
}

# Run the SQL script
try {
    Write-Host "▶️  Running migration..." -ForegroundColor Yellow
    
    $result = & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $sqlFile 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Added columns:" -ForegroundColor Cyan
        Write-Host "  • product_id (UUID)" -ForegroundColor Gray
        Write-Host "  • name (VARCHAR)" -ForegroundColor Gray
        Write-Host "  • tax_amount (DECIMAL)" -ForegroundColor Gray
        Write-Host "  • tax_rate (DECIMAL)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "🎉 Invoice items table is now up to date!" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration failed!" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error running migration: $_" -ForegroundColor Red
    exit 1
}
