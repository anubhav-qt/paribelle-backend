#!/usr/bin/env pwsh
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Restarting Marketplace Services" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if RESET_DB environment variable is set
if ($env:RESET_DB -eq "true") {
    Write-Host "`n🔄 RESET_DB enabled - Reinitializing database..." -ForegroundColor Magenta
    Write-Host "Running: npm install && npm run build && node initialsetup/init-database.js --force && npm run seed" -ForegroundColor Yellow
    
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install failed" -ForegroundColor Red
        exit 1
    }
    
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
    
    node initialsetup/init-database.js --force
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Database initialization failed" -ForegroundColor Red
        exit 1
    }
    
    npm run seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Seeding failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Database reset complete!" -ForegroundColor Green
    Write-Host "`nTo disable database reset, run: `$env:RESET_DB=`"false`"" -ForegroundColor Yellow
    Write-Host "Or simply restart PowerShell to clear the variable`n" -ForegroundColor Yellow
}

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
$backendPath = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Starting Backend Server...' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 5

# Start web
Write-Host "Starting Web App (Port 3000)..." -ForegroundColor Green
$webPath = Join-Path (Split-Path $PSScriptRoot) "marketplace-web"
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

if ($env:RESET_DB -eq "true") {
    Write-Host "`n💡 Tip: Database was reset. To skip reset next time:" -ForegroundColor Cyan
    Write-Host "   `$env:RESET_DB=`"false`"" -ForegroundColor Gray
}
