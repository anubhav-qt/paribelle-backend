# Run vendor shipping settings migration
$ErrorActionPreference = "Stop"

Write-Host "Running vendor shipping settings migration..." -ForegroundColor Cyan

# SQL commands
$sql = @"
-- Add shipping settings to vendors table
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS "freeShippingThreshold" DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS "shippingCost" DECIMAL(10,2) DEFAULT 50.00;

-- Update existing vendors with default shipping cost
UPDATE vendors SET "shippingCost" = 50.00 WHERE "shippingCost" IS NULL;

SELECT 'Migration completed successfully' AS status;
"@

# Execute SQL
try {
    # Try using psql if available
    $sql | & psql -U postgres -d marketplace 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Migration completed successfully!" -ForegroundColor Green
        exit 0
    }
} catch {
    Write-Host "psql not found in PATH, trying direct connection..." -ForegroundColor Yellow
}

# Fallback: Try using .NET PostgreSQL client
try {
    Add-Type -Path "C:\Program Files\PostgreSQL\16\lib\Npgsql.dll" -ErrorAction SilentlyContinue
    
    $connString = "Host=localhost;Database=marketplace;Username=postgres;Password=1234"
    $conn = New-Object Npgsql.NpgsqlConnection($connString)
    $conn.Open()
    
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $sql
    $cmd.ExecuteNonQuery() | Out-Null
    
    $conn.Close()
    Write-Host "✓ Migration completed successfully using .NET client!" -ForegroundColor Green
} catch {
    Write-Host "✗ Could not run migration automatically." -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run this SQL manually in your PostgreSQL database:" -ForegroundColor Yellow
    Write-Host $sql -ForegroundColor White
    exit 1
}
