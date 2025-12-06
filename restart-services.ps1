#!/usr/bin/env pwsh
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Restarting Marketplace Services" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Kill processes on ports 3000 and 3001
Write-Host "`nStopping existing services..." -ForegroundColor Yellow
$ports = @(3000, 3001)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($proc in $processes) {
            try {
                $processName = (Get-Process -Id $proc -ErrorAction SilentlyContinue).ProcessName
                Write-Host "  Killing process $processName (PID: $proc) on port $port" -ForegroundColor Yellow
                Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Host "  Could not stop process $proc" -ForegroundColor Red
            }
        }
    }
}

Start-Sleep -Seconds 2

# Start backend
Write-Host "`nStarting Backend (Port 3001)..." -ForegroundColor Green
$backendPath = Join-Path $PSScriptRoot "apps\backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Starting Backend Server...' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 5

# Start web
Write-Host "Starting Web App (Port 3000)..." -ForegroundColor Green
$webPath = Join-Path $PSScriptRoot "apps\web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webPath'; Write-Host 'Starting Web Server...' -ForegroundColor Green; npm run dev"

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "✅ Services Starting..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "`nURLs:" -ForegroundColor White
Write-Host "  Backend API: " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Web App:     " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API Docs:    " -NoNewline; Write-Host "http://localhost:3001/api" -ForegroundColor Cyan
Write-Host "`nCheck the new terminal windows for server logs" -ForegroundColor Yellow
Write-Host "Press Ctrl+C in those windows to stop the servers" -ForegroundColor Yellow
