#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Check and fix admin login credentials in Neon (production) database

.DESCRIPTION
    Sets DATABASE_URL to Neon connection string and runs admin credential check
#>

Write-Host "🔧 Setting up Neon database connection..." -ForegroundColor Cyan

# Read DATABASE_URL from marketplace-backend-render.env
$renderEnvPath = Join-Path $PSScriptRoot "marketplace-backend-render.env"

if (-not (Test-Path $renderEnvPath)) {
    Write-Host "❌ Error: marketplace-backend-render.env not found!" -ForegroundColor Red
    Write-Host "   Expected at: $renderEnvPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "📄 Reading Neon connection from: marketplace-backend-render.env" -ForegroundColor Gray

# Parse the env file to get DATABASE_URL
$databaseUrl = Get-Content $renderEnvPath | Where-Object { $_ -match '^DATABASE_URL=' } | ForEach-Object {
    $_ -replace '^DATABASE_URL=', ''
}

if (-not $databaseUrl) {
    Write-Host "❌ Error: DATABASE_URL not found in marketplace-backend-render.env" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found Neon connection string" -ForegroundColor Green
Write-Host "🔌 Connecting to: $(($databaseUrl -split '@')[1])" -ForegroundColor Cyan

# Set environment variable for this session
$env:DATABASE_URL = $databaseUrl

Write-Host "`n🚀 Running admin credential check...`n" -ForegroundColor Cyan

# Run the admin login check script
node check-admin-login.js

$exitCode = $LASTEXITCODE

if ($exitCode -eq 0) {
    Write-Host "`n✅ Admin check completed successfully!" -ForegroundColor Green
} else {
    Write-Host "`n❌ Admin check failed with exit code: $exitCode" -ForegroundColor Red
}

exit $exitCode
