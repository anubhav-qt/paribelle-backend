# ============================================================
# Marketplace Backend Database Initialization Script
# ============================================================
# This PowerShell script initializes the database for first-time deployment
# ============================================================

param(
    [string]$DBHost = "localhost",
    [string]$DBPort = "5432",
    [string]$DBUser = "admin",
    [string]$DBPassword = "admin",
    [string]$DBName = "marketplace",
    [switch]$CreateDatabase = $false
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🚀 Marketplace Database Initialization" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if psql is available
try {
    $psqlVersion = psql --version
    Write-Host "✅ PostgreSQL client found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ PostgreSQL client (psql) not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL and ensure 'psql' is in your PATH." -ForegroundColor Yellow
    exit 1
}

# Set environment variable for password (avoid password prompt)
$env:PGPASSWORD = $DBPassword

Write-Host "📋 Configuration:" -ForegroundColor White
Write-Host "   Host: $DBHost" -ForegroundColor Gray
Write-Host "   Port: $DBPort" -ForegroundColor Gray
Write-Host "   User: $DBUser" -ForegroundColor Gray
Write-Host "   Database: $DBName" -ForegroundColor Gray
Write-Host ""

# Create database if requested
if ($CreateDatabase) {
    Write-Host "🏗️  Creating database '$DBName'..." -ForegroundColor Yellow
    
    $createDbSql = @"
CREATE DATABASE $DBName OWNER $DBUser;
"@
    
    try {
        $createDbSql | psql -h $DBHost -p $DBPort -U $DBUser -d postgres 2>&1 | Out-Null
        Write-Host "✅ Database created successfully!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Database might already exist or creation failed." -ForegroundColor Yellow
        Write-Host "   Continuing with initialization..." -ForegroundColor Gray
    }
    Write-Host ""
}

# Check if database exists
Write-Host "🔍 Checking database connection..." -ForegroundColor Yellow
try {
    $result = psql -h $DBHost -p $DBPort -U $DBUser -d $DBName -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Cannot connect to database '$DBName'" -ForegroundColor Red
        Write-Host "Please ensure the database exists or use -CreateDatabase flag." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "✅ Database connection successful!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Cannot connect to database '$DBName'" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
}

# Run the initialization SQL script
$scriptPath = Join-Path $PSScriptRoot "init-database.sql"

if (-not (Test-Path $scriptPath)) {
    Write-Host "❌ SQL script not found: $scriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "🔧 Running database initialization script..." -ForegroundColor Yellow
Write-Host "   Script: $scriptPath" -ForegroundColor Gray
Write-Host ""

try {
    # Execute the SQL script
    $output = psql -h $DBHost -p $DBPort -U $DBUser -d $DBName -f $scriptPath 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ Database Initialization Complete!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Database schema created successfully with:" -ForegroundColor White
        Write-Host "   ✓ Core tables (users, categories, addresses)" -ForegroundColor Gray
        Write-Host "   ✓ Vendor tables (vendors, pages, blog posts)" -ForegroundColor Gray
        Write-Host "   ✓ Product tables (products, variants)" -ForegroundColor Gray
        Write-Host "   ✓ Order tables (orders, order items, payments)" -ForegroundColor Gray
        Write-Host "   ✓ Invoice tables (invoices, invoice items)" -ForegroundColor Gray
        Write-Host "   ✓ Review tables (product & vendor reviews)" -ForegroundColor Gray
        Write-Host "   ✓ Settings tables (platform, homepage, footer)" -ForegroundColor Gray
        Write-Host "   ✓ Location tables (cities, sub-locations)" -ForegroundColor Gray
        Write-Host "   ✓ Performance indexes" -ForegroundColor Gray
        Write-Host ""
        Write-Host "📝 Next steps:" -ForegroundColor Cyan
        Write-Host "   1. Update .env file with database credentials:" -ForegroundColor White
        Write-Host "      DB_HOST=$DBHost" -ForegroundColor Gray
        Write-Host "      DB_PORT=$DBPort" -ForegroundColor Gray
        Write-Host "      DB_USERNAME=$DBUser" -ForegroundColor Gray
        Write-Host "      DB_PASSWORD=your_password" -ForegroundColor Gray
        Write-Host "      DB_DATABASE=$DBName" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   2. (Optional) Seed initial data:" -ForegroundColor White
        Write-Host "      npm run seed" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   3. Start your backend server:" -ForegroundColor White
        Write-Host "      npm run dev" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "❌ Database initialization failed!" -ForegroundColor Red
        Write-Host "Output:" -ForegroundColor Yellow
        Write-Host $output -ForegroundColor Gray
        exit 1
    }
} catch {
    Write-Host "❌ Error running initialization script!" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Clear password from environment
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "🎉 Setup complete! Your marketplace is ready to launch!" -ForegroundColor Green
Write-Host ""
