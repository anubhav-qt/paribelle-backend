// filepath: d:\workdir\Copilot\GIT\marketplace\setup-database.ps1
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Database Setup for Marketplace" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$dbName = "marketplace"
$dbUser = "admin"
$dbPassword = "admin"

Write-Host "`nStep 1: Creating PostgreSQL database..." -ForegroundColor Yellow

# SQL commands to create database
$sqlCommands = @"
CREATE USER $dbUser WITH PASSWORD '$dbPassword';
CREATE DATABASE $dbName OWNER $dbUser;
GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;
"@

Write-Host "`nPlease run these commands in pgAdmin or psql:" -ForegroundColor Yellow
Write-Host $sqlCommands -ForegroundColor Cyan
Write-Host "`nOr run this command:" -ForegroundColor Yellow
Write-Host "psql -U postgres -c `"CREATE DATABASE $dbName;`"" -ForegroundColor Cyan

$response = Read-Host "`nHave you created the database? (y/n)"
if ($response -ne 'y') {
    Write-Host "Please create the database first and run this script again." -ForegroundColor Red
    exit
}

Write-Host "`nStep 2: Installing dependencies..." -ForegroundColor Yellow
cd apps\backend
npm install

Write-Host "`nStep 3: Syncing database schema..." -ForegroundColor Yellow
Write-Host "Starting application to auto-create tables..." -ForegroundColor Green

# The synchronize: true option will create tables automatically
npm run dev

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "Database should be set up!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan