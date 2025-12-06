#!/usr/bin/env pwsh
# Install all dependencies for Marketplace

Write-Host "📦 Installing Marketplace Dependencies..." -ForegroundColor Cyan
Write-Host ""

# Backend
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Set-Location apps/backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend installation failed" -ForegroundColor Red
    Set-Location ../..
    exit 1
}
Set-Location ../..
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
Write-Host ""

# Web
Write-Host "Installing web dependencies..." -ForegroundColor Yellow
Set-Location apps/web
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Web installation failed" -ForegroundColor Red
    Set-Location ../..
    exit 1
}
Set-Location ../..
Write-Host "✅ Web dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "🎉 All dependencies installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Setup your .env files" -ForegroundColor Gray
Write-Host "  2. Run: .\start-dev.ps1" -ForegroundColor Gray
