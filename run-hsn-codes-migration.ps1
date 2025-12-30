# HSN Codes Migration Script
# Run this script to create the hsn_codes table and seed initial data

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDir "src\migrations\create-hsn-codes-table.sql"

Write-Host "Running HSN Codes migration..." -ForegroundColor Cyan

# Load environment variables
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+?)\s*$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

$dbHost = $env:DB_HOST
$dbPort = $env:DB_PORT
$dbUser = $env:DB_USERNAME
$dbName = $env:DB_DATABASE
$dbPassword = $env:DB_PASSWORD

if (-not $dbHost -or -not $dbUser -or -not $dbName) {
    Write-Host "Error: Database configuration not found in .env file" -ForegroundColor Red
    exit 1
}

# Set PGPASSWORD environment variable for psql
$env:PGPASSWORD = $dbPassword

# Run the SQL file
Write-Host "Executing SQL migration..." -ForegroundColor Yellow
$sqlContent = Get-Content $sqlFile -Raw
$sqlContent | & psql -h $dbHost -p $dbPort -U $dbUser -d $dbName

if ($LASTEXITCODE -eq 0) {
    Write-Host "HSN Codes migration completed successfully!" -ForegroundColor Green
} else {
    Write-Host "HSN Codes migration failed!" -ForegroundColor Red
    exit 1
}
