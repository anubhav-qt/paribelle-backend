# Seed Location Data Script
# Run this to populate cities and sub-locations in the database

Write-Host "🌍 Starting Location Data Seeding..." -ForegroundColor Cyan
Write-Host ""

# Navigate to backend directory
Set-Location apps\backend

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "⚠️  node_modules not found. Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Run the seed script
Write-Host "📍 Seeding cities and sub-locations..." -ForegroundColor Green
npx ts-node src/database/seed-locations-runner.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Location seeding completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Seeded locations:" -ForegroundColor Cyan
    Write-Host "  • Mumbai (7 areas)"
    Write-Host "  • Delhi (6 areas)"
    Write-Host "  • Bangalore (6 areas)"
    Write-Host "  • Pune (5 areas)"
    Write-Host "  • Hyderabad (5 areas)"
    Write-Host "  • Chennai (5 areas)"
    Write-Host "  • Kolkata (4 areas)"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Restart your backend server"
    Write-Host "  2. Test the location filter on the main marketplace"
    Write-Host "  3. Assign locations to vendors"
} else {
    Write-Host ""
    Write-Host "❌ Location seeding failed!" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Red
}

# Return to root directory
Set-Location ..\..

Write-Host ""
Read-Host "Press Enter to exit"
