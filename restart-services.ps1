#!/usr/bin/env pwsh
param(
    [switch]$ResetDB,
    [switch]$Build,
    [switch]$Help
)

if ($Help) {
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host "  Marketplace Restart Script Help" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "USAGE:" -ForegroundColor Yellow
    Write-Host "  .\restart-services.ps1 [options]"
    Write-Host ""
    Write-Host "OPTIONS:" -ForegroundColor Yellow
    Write-Host "  -ResetDB                          Reset database (init + seed)" -ForegroundColor White
    Write-Host "  -Build                            Build in production mode" -ForegroundColor White
    Write-Host "  -Help                             Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "ENVIRONMENT VARIABLES:" -ForegroundColor Yellow
    Write-Host "  `$env:RESET_DB=`"true`"                Reset DB on every restart"
    Write-Host "  `$env:BUILD_MODE=`"true`"              Always use production builds"
    Write-Host ""
    Write-Host "EXAMPLES:" -ForegroundColor Yellow
    Write-Host "  .\restart-services.ps1                # Start in dev mode"
    Write-Host "  .\restart-services.ps1 -ResetDB       # Reset database and start"
    Write-Host "  .\restart-services.ps1 -Build         # Build and start in production"
    Write-Host "  .\restart-services.ps1 -ResetDB -Build  # Both options"
    Write-Host ""
    Write-Host "SERVICES:" -ForegroundColor Yellow
    Write-Host "  Backend API:  http://localhost:3001"
    Write-Host "  Web App:      http://localhost:3000"
    Write-Host "  API Docs:     http://localhost:3001/api/docs"
    Write-Host ""
    Write-Host "MODES:" -ForegroundColor Yellow
    Write-Host "  Development:  Fast restart, hot reload, npm run dev"
    Write-Host "  Production:   Full build, optimized, npm run start/start:prod"
    Write-Host ""
    exit 0
}

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Restarting Marketplace Services" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if BUILD_MODE is enabled (parameter takes precedence over env var)
$buildMode = if ($Build) { $true } else { $env:BUILD_MODE -eq "true" }
$resetDb = if ($ResetDB) { $true } else { $env:RESET_DB -eq "true" }

if ($buildMode) {
    Write-Host "`n🔨 BUILD MODE ENABLED - Building projects..." -ForegroundColor Magenta
    
    # Build Backend
    Write-Host "`n📦 Building Backend..." -ForegroundColor Yellow
    $backendPath = $PSScriptRoot
    Set-Location $backendPath
    
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Backend npm install failed" -ForegroundColor Red
        exit 1
    }
    
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Backend build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Backend built successfully!" -ForegroundColor Green
    
    # Build Frontend
    Write-Host "`n📦 Building Frontend..." -ForegroundColor Yellow
    $webPath = Join-Path (Split-Path $PSScriptRoot) "marketplace-web"
    Set-Location $webPath
    
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend npm install failed" -ForegroundColor Red
        exit 1
    }
    
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Frontend build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Frontend built successfully!" -ForegroundColor Green
    
    # Return to backend directory
    Set-Location $backendPath
    
    Write-Host "`n✅ All builds complete!" -ForegroundColor Green
    Write-Host "`nTo disable build mode next time, run: `$env:BUILD_MODE=`"false`"" -ForegroundColor Yellow
}

# Check if RESET_DB environment variable is set
if ($resetDb) {
    Write-Host "`n🔄 RESET_DB enabled - Reinitializing database..." -ForegroundColor Magenta
    
    if (-not $buildMode) {
        Write-Host "Running: npm install && npm run build" -ForegroundColor Yellow
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
    }
    
    Write-Host "Running database reset (drop + recreate from entities)..." -ForegroundColor Yellow
    npx ts-node -r tsconfig-paths/register src/database/reset-database.ts --force
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Database reset failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Running seed data..." -ForegroundColor Yellow
    npm run seed
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Seeding failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Database reset complete!" -ForegroundColor Green
    Write-Host "`nTo disable database reset, run: `$env:RESET_DB=`"false`"" -ForegroundColor Yellow
}

# Determine which mode to run (dev or prod)
$runMode = if ($buildMode) { "start:prod" } else { "dev" }
$modeLabel = if ($buildMode) { "PRODUCTION" } else { "DEVELOPMENT" }

Write-Host "`n🚀 Starting services in $modeLabel mode..." -ForegroundColor Cyan

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
Write-Host "`nStarting Backend (Port 3001) in $modeLabel mode..." -ForegroundColor Green
$backendPath = $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Starting Backend Server ($modeLabel)...' -ForegroundColor Green; npm run $runMode"

Start-Sleep -Seconds 5

# Start web (always use 'dev' for Next.js, or 'start' for production)
$webRunMode = if ($buildMode) { "start" } else { "dev" }
Write-Host "Starting Web App (Port 3000) in $modeLabel mode..." -ForegroundColor Green
$webPath = Join-Path (Split-Path $PSScriptRoot) "marketplace-web"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$webPath'; Write-Host 'Starting Web Server ($modeLabel)...' -ForegroundColor Green; npm run $webRunMode"

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "✅ Services Starting in $modeLabel mode..." -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "`nURLs:" -ForegroundColor White
Write-Host "  Backend API: " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Web App:     " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Cyan
Write-Host "  API Docs:    " -NoNewline; Write-Host "http://localhost:3001/api/docs" -ForegroundColor Cyan
Write-Host "`nCheck the new terminal windows for server logs" -ForegroundColor Yellow
Write-Host "Press Ctrl+C in those windows to stop the servers" -ForegroundColor Yellow

Write-Host "`n💡 Usage Tips:" -ForegroundColor Cyan
Write-Host "   Command-line options:" -ForegroundColor Gray
Write-Host "     .\restart-services.ps1 -ResetDB    # Reset database and restart" -ForegroundColor Gray
Write-Host "     .\restart-services.ps1 -Build      # Build projects in production mode" -ForegroundColor Gray
Write-Host "     .\restart-services.ps1 -ResetDB -Build # Both options" -ForegroundColor Gray
Write-Host "" -ForegroundColor Gray
if ($buildMode) {
    Write-Host "   Currently in BUILD mode (production builds + production servers)" -ForegroundColor Gray
    Write-Host "   To switch to dev mode: `$env:BUILD_MODE=`"false`" or restart PowerShell" -ForegroundColor Gray
} else {
    Write-Host "   Currently in DEV mode (development servers with hot reload)" -ForegroundColor Gray
    Write-Host "   To enable build mode: `$env:BUILD_MODE=`"true`" or use -Build parameter" -ForegroundColor Gray
}

if ($resetDb) {
    Write-Host "   Database was reset. To skip reset next time, don't use -ResetDB" -ForegroundColor Gray
}
