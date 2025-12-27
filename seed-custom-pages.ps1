# Seed Custom Pages Script
# This script uses Node.js to seed the database with custom page templates

Write-Host "🌱 Seeding custom page templates..." -ForegroundColor Cyan

# Check if Node.js is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Run the JavaScript seeding script
try {
    $result = node seed-custom-pages.js 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host $result -ForegroundColor Green
    } else {
        Write-Host "❌ Error seeding custom pages:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✨ Done!" -ForegroundColor Green
