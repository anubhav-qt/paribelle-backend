# Invoice System Setup Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Invoice System Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location -Path "marketplace-backend"

Write-Host "[1/5] Installing dependencies..." -ForegroundColor Yellow
npm install pdfkit
npm install --save-dev @types/pdfkit

Write-Host ""
Write-Host "[2/5] Creating upload directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "uploads/invoices" | Out-Null
Write-Host "✓ Created uploads/invoices directory" -ForegroundColor Green

Write-Host ""
Write-Host "[3/5] Setting up database..." -ForegroundColor Yellow
Write-Host "Please run the following SQL file in your PostgreSQL database:" -ForegroundColor Yellow
Write-Host "  psql -U your_user -d your_database -f create-invoices-tables.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or copy the contents of 'create-invoices-tables.sql' and run it manually." -ForegroundColor Yellow

Write-Host ""
Write-Host "[4/5] Checking environment variables..." -ForegroundColor Yellow
$envFile = ".env"
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile -Raw
    
    $requiredVars = @(
        "APP_NAME",
        "APP_ADDRESS",
        "APP_PHONE",
        "APP_EMAIL",
        "MAIL_HOST",
        "MAIL_PORT",
        "MAIL_USER",
        "MAIL_PASSWORD",
        "MAIL_FROM"
    )
    
    $missingVars = @()
    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "$var=") {
            $missingVars += $var
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host "⚠ Missing environment variables:" -ForegroundColor Yellow
        foreach ($var in $missingVars) {
            Write-Host "  - $var" -ForegroundColor Red
        }
        Write-Host ""
        Write-Host "Please add these to your .env file:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "# Company information for invoices" -ForegroundColor Gray
        Write-Host "APP_NAME=Your Marketplace" -ForegroundColor Gray
        Write-Host "APP_ADDRESS=Your Company Address" -ForegroundColor Gray
        Write-Host "APP_PHONE=+91 1234567890" -ForegroundColor Gray
        Write-Host "APP_EMAIL=info@yourmarketplace.com" -ForegroundColor Gray
        Write-Host ""
        Write-Host "# Email configuration" -ForegroundColor Gray
        Write-Host "MAIL_HOST=smtp.gmail.com" -ForegroundColor Gray
        Write-Host "MAIL_PORT=587" -ForegroundColor Gray
        Write-Host "MAIL_USER=your-email@gmail.com" -ForegroundColor Gray
        Write-Host "MAIL_PASSWORD=your-app-password" -ForegroundColor Gray
        Write-Host "MAIL_FROM=Your Marketplace <noreply@yourmarketplace.com>" -ForegroundColor Gray
    } else {
        Write-Host "✓ All required environment variables are set" -ForegroundColor Green
    }
} else {
    Write-Host "⚠ .env file not found" -ForegroundColor Red
    Write-Host "Please create a .env file with the required variables" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[5/5] Setup complete!" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Run the database migration:" -ForegroundColor White
Write-Host "   psql -U your_user -d your_database -f create-invoices-tables.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Restart your backend server:" -ForegroundColor White
Write-Host "   npm run start:dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Test the invoice system:" -ForegroundColor White
Write-Host "   - Navigate to /admin/invoices" -ForegroundColor Gray
Write-Host "   - Click 'Auto-Generate Invoices'" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Check the documentation:" -ForegroundColor White
Write-Host "   - Read INVOICE_SYSTEM_README.md for full details" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Done! 🎉" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
