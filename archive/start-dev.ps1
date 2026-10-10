#!/usr/bin/env pwsh
# Development Startup Script for Marketplace

Write-Host "🚀 Starting Marketplace Development Environment..." -ForegroundColor Cyan
Write-Host ""

# Kill processes using ports 3000 and 3001
Write-Host "🔍 Checking for processes on ports 3000 and 3001..." -ForegroundColor Yellow

$ports = @(3000, 3001)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Host "  Stopping process $($process.Name) (PID: $($process.Id)) on port $port" -ForegroundColor Gray
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "✅ Ports cleared!" -ForegroundColor Green
Write-Host ""

# Check if node_modules exist
$backendModules = Test-Path "apps/backend/node_modules"
$webModules = Test-Path "apps/web/node_modules"

if (-not $backendModules) {
    Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location apps/backend
    npm install
    Set-Location ../..
}

if (-not $webModules) {
    Write-Host "📦 Installing web dependencies..." -ForegroundColor Yellow
    Set-Location apps/web
    npm install
    Set-Location ../..
}

Write-Host ""
Write-Host "✅ Dependencies ready!" -ForegroundColor Green
Write-Host ""
Write-Host "🔧 Starting services..." -ForegroundColor Cyan
Write-Host "   Backend API: http://localhost:3001" -ForegroundColor Gray
Write-Host "   Web App:     http://localhost:3000" -ForegroundColor Gray
Write-Host "   API Docs:    http://localhost:3001/api" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Start both services in parallel
$backend = Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/backend; npm run dev" -PassThru
$web = Start-Process pwsh -ArgumentList "-NoExit", "-Command", "cd apps/web; npm run dev" -PassThru

Write-Host "✨ All services started!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend PID: $($backend.Id)" -ForegroundColor Gray
Write-Host "Web PID:     $($web.Id)" -ForegroundColor Gray
Write-Host ""

# Wait for user to press Ctrl+C
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host "🛑 Stopping services..." -ForegroundColor Yellow
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue
    Write-Host "✅ All services stopped" -ForegroundColor Green
}
