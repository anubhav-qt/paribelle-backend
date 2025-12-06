#!/usr/bin/env pwsh
# Fix PostgreSQL Permissions for Marketplace Database

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Fix Database Permissions" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$dbName = "marketplace"
$dbUser = "admin"

Write-Host "`nThis script will fix permissions for user '$dbUser' on database '$dbName'" -ForegroundColor Yellow
Write-Host ""
Write-Host "Please run these SQL commands in pgAdmin or psql:" -ForegroundColor Cyan
Write-Host ""
Write-Host "-- Connect as postgres superuser and run:" -ForegroundColor Gray
Write-Host ""
Write-Host "\c $dbName" -ForegroundColor White
Write-Host ""
Write-Host "-- Grant all schema permissions" -ForegroundColor Gray
Write-Host "GRANT ALL ON SCHEMA public TO $dbUser;" -ForegroundColor White
Write-Host "GRANT CREATE ON SCHEMA public TO $dbUser;" -ForegroundColor White
Write-Host "GRANT USAGE ON SCHEMA public TO $dbUser;" -ForegroundColor White
Write-Host ""
Write-Host "-- Set default privileges" -ForegroundColor Gray
Write-Host "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $dbUser;" -ForegroundColor White
Write-Host "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $dbUser;" -ForegroundColor White
Write-Host "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO $dbUser;" -ForegroundColor White
Write-Host ""
Write-Host "-- Make user the database owner" -ForegroundColor Gray
Write-Host "ALTER DATABASE $dbName OWNER TO $dbUser;" -ForegroundColor White
Write-Host ""
Write-Host "-- Grant all privileges" -ForegroundColor Gray
Write-Host "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;" -ForegroundColor White
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Alternative: Run with psql" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "psql -U postgres -d $dbName -c `"GRANT ALL ON SCHEMA public TO $dbUser;`"" -ForegroundColor Gray
Write-Host "psql -U postgres -d $dbName -c `"ALTER DATABASE $dbName OWNER TO $dbUser;`"" -ForegroundColor Gray
Write-Host ""

$response = Read-Host "Do you want to try automatic execution? (y/n)"
if ($response -eq 'y') {
    # Find PostgreSQL installation
    $pgPaths = @(
        "D:\workdir\Apps\PostgreSQL\18\bin",
        "C:\Program Files\PostgreSQL\18\bin",
        "C:\Program Files\PostgreSQL\17\bin",
        "C:\Program Files\PostgreSQL\16\bin"
    )

    $psqlPath = $null
    foreach ($path in $pgPaths) {
        if (Test-Path (Join-Path $path "psql.exe")) {
            $psqlPath = Join-Path $path "psql.exe"
            break
        }
    }

    if ($psqlPath) {
        Write-Host "`nAttempting to fix permissions..." -ForegroundColor Yellow
        
        $env:PGPASSWORD = ""
        & $psqlPath -U postgres -d $dbName -c "GRANT ALL ON SCHEMA public TO $dbUser;"
        & $psqlPath -U postgres -d $dbName -c "GRANT CREATE ON SCHEMA public TO $dbUser;"
        & $psqlPath -U postgres -d $dbName -c "GRANT USAGE ON SCHEMA public TO $dbUser;"
        & $psqlPath -U postgres -d $dbName -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $dbUser;"
        & $psqlPath -U postgres -d $dbName -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO $dbUser;"
        & $psqlPath -U postgres -d $dbName -c "ALTER DATABASE $dbName OWNER TO $dbUser;"
        & $psqlPath -U postgres -d $dbName -c "GRANT ALL PRIVILEGES ON DATABASE $dbName TO $dbUser;"
        
        Write-Host "`n✅ Permissions updated!" -ForegroundColor Green
    } else {
        Write-Host "`npsql not found. Please run the SQL commands manually." -ForegroundColor Red
    }
}

Write-Host "`nAfter fixing permissions, restart the backend:" -ForegroundColor Yellow
Write-Host "  .\restart-services.ps1" -ForegroundColor Gray
Write-Host ""
