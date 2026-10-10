# Run Search Indexes Migration
# This script applies database indexes for search optimization

Write-Host "Running search indexes migration..." -ForegroundColor Cyan

# Load environment variables from .env file
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
    Write-Host "Environment variables loaded from .env" -ForegroundColor Green
} else {
    Write-Host ".env file not found, using existing environment variables" -ForegroundColor Yellow
}

# Get database connection parameters
$dbHost = $env:DB_HOST
$dbPort = $env:DB_PORT
$dbUser = $env:DB_USERNAME
$dbName = $env:DB_DATABASE
$dbPassword = $env:DB_PASSWORD

if (-not $dbHost) { $dbHost = "localhost" }
if (-not $dbPort) { $dbPort = "5432" }
if (-not $dbUser) { $dbUser = "admin" }
if (-not $dbName) { $dbName = "marketplace" }

Write-Host "Database: $dbName on ${dbHost}:${dbPort}" -ForegroundColor Cyan

# Set PGPASSWORD environment variable for authentication
$env:PGPASSWORD = $dbPassword

# First enable pg_trgm extension
Write-Host "`nEnabling pg_trgm extension..." -ForegroundColor Cyan
$extensionSql = "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
$extensionSql | psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -v ON_ERROR_STOP=1

if ($LASTEXITCODE -eq 0) {
    Write-Host "pg_trgm extension enabled successfully" -ForegroundColor Green
} else {
    Write-Host "Warning: Could not enable pg_trgm extension (may already be enabled or not available)" -ForegroundColor Yellow
}

# Run the migration
Write-Host "`nCreating search indexes..." -ForegroundColor Cyan
psql -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "database/migrations/create-search-indexes.sql" -v ON_ERROR_STOP=1

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSearch indexes created successfully!" -ForegroundColor Green
    Write-Host "Search queries will now be faster." -ForegroundColor Green
} else {
    Write-Host "`nError: Failed to create indexes" -ForegroundColor Red
    exit 1
}

# Clear password from environment
$env:PGPASSWORD = $null

Write-Host "`nDone!" -ForegroundColor Cyan
