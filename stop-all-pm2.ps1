#!/usr/bin/env pwsh
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Stopping Marketplace (PM2 Mode)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Stop PM2 processes
Write-Host "`nStopping PM2 backend instances..." -ForegroundColor Yellow
pm2 stop all
pm2 delete all

# Kill processes on port 3000 (web)
Write-Host "`nStopping web service on port 3000..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($proc in $processes) {
        try {
            $processName = (Get-Process -Id $proc -ErrorAction SilentlyContinue).ProcessName
            Write-Host "  Killing process $processName (PID: $proc)" -ForegroundColor Yellow
            Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "  Could not stop process $proc" -ForegroundColor Red
        }
    }
}

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "✅ All Services Stopped!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
