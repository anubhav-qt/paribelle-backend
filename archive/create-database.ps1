#!/usr/bin/env pwsh
# Database Creation Script for Marketplace

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL Database Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Configuration
$dbName = "marketplace"
$dbUser = "admin"
$dbPassword = "admin"
$pgSuperUser = "postgres"
$pgHost = "localhost"
$pgPort = 5432

Write-Host "`nDatabase Configuration:" -ForegroundColor Yellow
Write-Host "  Database: $dbName" -ForegroundColor Gray
Write-Host "  User:     $dbUser" -ForegroundColor Gray
Write-Host "  Host:     $pgHost" -ForegroundColor Gray
Write-Host "  Port:     $pgPort" -ForegroundColor Gray
Write-Host ""

# Find PostgreSQL installation
$pgPaths = @(
    "D:\workdir\Apps\PostgreSQL\18\bin",
    "D:\workdir\Apps\PostgreSQL\17\bin",
    "D:\workdir\Apps\PostgreSQL\16\bin",
    "D:\workdir\Apps\PostgreSQL\15\bin",
    "D:\workdir\Apps\PostgreSQL\14\bin",
    "D:\workdir\Apps\PostgreSQL\13\bin"
)

$psqlPath = $null
foreach ($path in $pgPaths) {
    if (Test-Path (Join-Path $path "psql.exe")) {
        $psqlPath = Join-Path $path "psql.exe"
        break
    }
}

if (-not $psqlPath) {
    Write-Host "PostgreSQL psql not found in standard locations." -ForegroundColor Yellow
    Write-Host "`nPlease run these SQL commands manually in pgAdmin or psql:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "-- Create user if not exists" -ForegroundColor Gray
    Write-Host "CREATE USER $dbUser WITH PASSWORD '$dbPassword';" -ForegroundColor White
    Write-Host ""
    Write-Host "-- Create database" -ForegroundColor Gray
    Write-Host "CREATE DATABASE $dbName OWNER $dbUser;" -ForegroundColor White
    Write-Host ""
    Write-Host "-- Grant privileges" -ForegroundColor Gray
    Write-Host "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;" -ForegroundColor White
    Write-Host "ALTER DATABASE $dbName OWNER TO $dbUser;" -ForegroundColor White
    Write-Host ""
    
    $response = Read-Host "Have you created the database manually? (y/n)"
    if ($response -ne 'y') {
        Write-Host "`nExiting. Please create the database and run this script again." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Found PostgreSQL at: $psqlPath" -ForegroundColor Green
    Write-Host ""
    
    # Create SQL commands file
    $sqlFile = Join-Path $PSScriptRoot "temp_create_db.sql"
    @"
-- Check if user exists and create if not
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$dbUser') THEN
        CREATE USER $dbUser WITH PASSWORD '$dbPassword';
    END IF;
END
`$`$;

-- Drop database if exists (optional - comment out if you want to keep existing data)
-- DROP DATABASE IF EXISTS $dbName;

-- Create database
SELECT 'CREATE DATABASE $dbName OWNER $dbUser'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$dbName')\gexec

-- Connect to the database and grant schema permissions
\c $dbName

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO $dbUser;
GRANT CREATE ON SCHEMA public TO $dbUser;
GRANT USAGE ON SCHEMA public TO $dbUser;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $dbUser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $dbUser;

-- Make the user owner of the database
ALTER DATABASE $dbName OWNER TO $dbUser;
"@ | Out-File -FilePath $sqlFile -Encoding UTF8
    
    Write-Host "Creating database..." -ForegroundColor Yellow
    
    try {
        # Execute SQL commands
        $env:PGPASSWORD = ""
        & $psqlPath -U $pgSuperUser -h $pgHost -p $pgPort -f $sqlFile
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✅ Database created successfully!" -ForegroundColor Green
        } else {
            Write-Host "`n⚠️  There might have been issues. Please check the output above." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "`n❌ Error creating database: $_" -ForegroundColor Red
        Write-Host "`nPlease create the database manually using the SQL commands shown above." -ForegroundColor Yellow
    } finally {
        # Clean up temp file
        Remove-Item $sqlFile -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "1. Start the backend server:" -ForegroundColor White
Write-Host "   cd apps\backend && npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "2. TypeORM will auto-create tables" -ForegroundColor White
Write-Host "   (synchronize: true in development)" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Check backend logs for SQL queries" -ForegroundColor White
Write-Host ""
