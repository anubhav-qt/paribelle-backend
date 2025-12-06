#!/usr/bin/env pwsh
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Restarting Marketplace (PM2 Mode)" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if PM2 is installed
Write-Host "`nChecking PM2 installation..." -ForegroundColor Yellow
$pm2Installed = Get-Command pm2 -ErrorAction SilentlyContinue
if (-not $pm2Installed) {
    Write-Host "❌ PM2 is not installed. Installing globally..." -ForegroundColor Red
    npm install -g pm2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install PM2. Please run: npm install -g pm2" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ PM2 installed successfully" -ForegroundColor Green
}

# Kill processes on port 3000 (web)
Write-Host "`nStopping existing web service..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($connections) {
    $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($proc in $processes) {
        try {
            $processName = (Get-Process -Id $proc -ErrorAction SilentlyContinue).ProcessName
            Write-Host "  Killing process $processName (PID: $proc) on port 3000" -ForegroundColor Yellow
            Stop-Process -Id $proc -Force -ErrorAction SilentlyContinue
        } catch {
            Write-Host "  Could not stop process $proc" -ForegroundColor Red
        }
    }
}

Start-Sleep -Seconds 2

# Build backend
Write-Host "`nBuilding Backend..." -ForegroundColor Green
$backendPath = Join-Path $PSScriptRoot "apps\backend"
Push-Location $backendPath
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend build failed" -ForegroundColor Red
    Pop-Location
    exit 1
}

# Restart backend with PM2
Write-Host "`nRestarting Backend with PM2 (Cluster Mode)..." -ForegroundColor Green
pm2 delete marketplace-backend -s 2>$null
pm2 start ecosystem.config.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to start backend with PM2" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Start-Sleep -Seconds 3

# Start web
Write-Host "`nStarting Web App (Port 3000)..." -ForegroundColor Green
$webPath = Join-Path $PSScriptRoot "apps\web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webPath'; Write-Host 'Starting Web Server...' -ForegroundColor Green; npm run dev"

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "✅ Services Started!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan

# Show PM2 status
Write-Host "`nPM2 Status:" -ForegroundColor White
pm2 list

Write-Host "`n📊 Backend Performance:" -ForegroundColor White
Write-Host "  - Running in CLUSTER mode" -ForegroundColor Cyan
Write-Host "  - Using ALL CPU cores" -ForegroundColor Cyan
Write-Host "  - Database indexes enabled" -ForegroundColor Cyan
Write-Host "  - Connection pooling active" -ForegroundColor Cyan

Write-Host "`n🌐 URLs:" -ForegroundColor White
Write-Host "  Backend API: " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Web App:     " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host "  GraphQL:     " -NoNewline; Write-Host "http://localhost:3001/graphql" -ForegroundColor Cyan

Write-Host "`n📝 Useful PM2 Commands:" -ForegroundColor White
Write-Host "  pm2 list              " -NoNewline; Write-Host "- View all processes" -ForegroundColor Gray
Write-Host "  pm2 logs              " -NoNewline; Write-Host "- View logs" -ForegroundColor Gray
Write-Host "  pm2 monit             " -NoNewline; Write-Host "- Real-time monitoring" -ForegroundColor Gray
Write-Host "  pm2 restart all       " -NoNewline; Write-Host "- Restart all instances" -ForegroundColor Gray
Write-Host "  pm2 stop all          " -NoNewline; Write-Host "- Stop all instances" -ForegroundColor Gray
Write-Host "  pm2 delete all        " -NoNewline; Write-Host "- Remove all processes" -ForegroundColor Gray

Write-Host "`nCheck the web terminal window for frontend logs" -ForegroundColor Yellow
