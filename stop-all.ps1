#!/usr/bin/env pwsh
# Stop all running services

Write-Host "🛑 Stopping all Marketplace services..." -ForegroundColor Yellow
Write-Host ""

# Find and stop Node processes running the app
$processes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*nest start*" -or 
    $_.CommandLine -like "*next dev*"
}

if ($processes) {
    foreach ($proc in $processes) {
        Write-Host "Stopping process $($proc.Id)..." -ForegroundColor Gray
        Stop-Process -Id $proc.Id -Force
    }
    Write-Host "✅ All services stopped" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No running services found" -ForegroundColor Cyan
}
