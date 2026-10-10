# Add transaction_id column to payments table
Write-Host "Adding transaction_id column to payments table..." -ForegroundColor Cyan

$env:PGPASSWORD = 'admin123'
$psqlPath = "C:\Program Files\PostgreSQL\16\bin\psql.exe"

if (Test-Path $psqlPath) {
    & $psqlPath -h localhost -U postgres -d marketplace -f add-payment-transaction-id.sql
} else {
    # Try to find psql in PATH
    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) {
        psql -h localhost -U postgres -d marketplace -f add-payment-transaction-id.sql
    } else {
        Write-Host "PostgreSQL psql not found. Running via node-postgres..." -ForegroundColor Yellow
        
        # Use node to run the SQL
        $sqlContent = Get-Content add-payment-transaction-id.sql -Raw
        
        $nodeScript = @"
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'marketplace',
  user: 'postgres',
  password: 'admin123',
});

async function runMigration() {
  try {
    const sql = ``$sqlContent``;
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
"@
        
        $nodeScript | Out-File -FilePath "run-migration-temp.js" -Encoding UTF8
        node run-migration-temp.js
        Remove-Item run-migration-temp.js -ErrorAction SilentlyContinue
    }
}

Write-Host "Done!" -ForegroundColor Green
