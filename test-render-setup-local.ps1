#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Test Render setup locally before deploying

.DESCRIPTION
    Runs the same process that Render will run:
    1. Create tables (with synchronize=true to drop/recreate)
    2. Seed all data
    3. Start the application
#>

Write-Host "🧪 ====================================" -ForegroundColor Cyan
Write-Host "🧪  Testing Render Setup Locally" -ForegroundColor Cyan
Write-Host "🧪 ====================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is running
Write-Host "🔍 Checking PostgreSQL..." -ForegroundColor Gray
$pgResult = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue

if (-not $pgResult.TcpTestSucceeded) {
    Write-Host "❌ PostgreSQL is not running on localhost:5432!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please start PostgreSQL first:" -ForegroundColor Yellow
    Write-Host "  - Open Services (services.msc)" -ForegroundColor White
    Write-Host "  - Find 'postgresql' service" -ForegroundColor White
    Write-Host "  - Click 'Start'" -ForegroundColor White
    Write-Host ""
    Write-Host "Or run: net start postgresql-x64-15" -ForegroundColor Gray
    Write-Host "(Replace version number with your PostgreSQL version)" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ PostgreSQL is running" -ForegroundColor Green
Write-Host ""

Write-Host "⚠️  This will:" -ForegroundColor Yellow
Write-Host "  1. DROP all tables in your LOCAL database" -ForegroundColor Red
Write-Host "  2. CREATE fresh tables with ALL columns" -ForegroundColor Green
Write-Host "  3. SEED all data (admin, products)" -ForegroundColor Green
Write-Host ""
Write-Host "Database: localhost:5432/marketplace" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "Type 'YES' to continue with local test"

if ($confirmation -ne 'YES') {
    Write-Host "❌ Test cancelled" -ForegroundColor Red
    exit 1
}

Write-Host "`n🏗️  Step 1: Creating tables..." -ForegroundColor Cyan
npm run render:create_tables
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Table creation failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🌱 Step 2: Seeding data..." -ForegroundColor Cyan
npm run render:seed_data
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Seeding failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n🔍 Step 3: Verifying database..." -ForegroundColor Cyan
node verify-db-schema.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Verification failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Local setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Verification Steps:" -ForegroundColor Cyan
Write-Host "1. Check database tables were created" -ForegroundColor White
Write-Host "2. Verify all columns exist (city_id, vendor_id, etc.)" -ForegroundColor White
Write-Host "3. Check admin user exists" -ForegroundColor White
Write-Host "4. Check products were seeded" -ForegroundColor White
Write-Host ""
Write-Host "🚀 Start the app:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "🔐 Test login:" -ForegroundColor Cyan
Write-Host "   Email: admin@marketplace.com" -ForegroundColor Gray
Write-Host "   Password: admin123" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ If everything works, commit and deploy to Render!" -ForegroundColor Green
