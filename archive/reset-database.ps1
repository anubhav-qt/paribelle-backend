# Reset database - drops and recreates marketplace database
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Resetting Marketplace Database" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$dbName = "marketplace"
$dbUser = "admin"
$dbPassword = "admin"
$pgSuperUser = "postgres"

# Find PostgreSQL installation
$pgPaths = @(
    "D:\workdir\Apps\PostgreSQL\18\bin",
    "D:\workdir\Apps\PostgreSQL\17\bin",
    "D:\workdir\Apps\PostgreSQL\16\bin",
    "D:\workdir\Apps\PostgreSQL\15\bin"
)

$psqlPath = $null
foreach ($path in $pgPaths) {
    if (Test-Path (Join-Path $path "psql.exe")) {
        $psqlPath = Join-Path $path "psql.exe"
        break
    }
}

if (-not $psqlPath) {
    Write-Host "PostgreSQL not found. Please drop and recreate the database manually in pgAdmin:" -ForegroundColor Yellow
    Write-Host "1. Right-click 'marketplace' database > Delete/Drop" -ForegroundColor White
    Write-Host "2. Right-click 'Databases' > Create > Database..." -ForegroundColor White
    Write-Host "   Name: marketplace" -ForegroundColor White
    Write-Host "   Owner: admin" -ForegroundColor White
    exit 1
}

Write-Host "Found PostgreSQL at: $psqlPath" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  This will DELETE all data in the marketplace database!" -ForegroundColor Red
$confirm = Read-Host "Continue? (y/n)"
if ($confirm -ne 'y') {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Dropping database..." -ForegroundColor Yellow
$env:PGPASSWORD = $dbPassword
& $psqlPath -U $dbUser -h localhost -d postgres -c "DROP DATABASE IF EXISTS $dbName;"

Write-Host "Creating database..." -ForegroundColor Yellow
& $psqlPath -U $dbUser -h localhost -d postgres -c "CREATE DATABASE $dbName OWNER $dbUser;"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Database reset complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now restart your backend server:" -ForegroundColor Cyan
    Write-Host "  cd apps\backend" -ForegroundColor Gray
    Write-Host "  npm run dev" -ForegroundColor Gray
    Write-Host ""
    Write-Host "TypeORM will auto-create all tables with the correct schema." -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "❌ Error resetting database" -ForegroundColor Red
}
