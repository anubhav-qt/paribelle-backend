#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Start local PostgreSQL service
#>

Write-Host "🚀 Starting PostgreSQL..." -ForegroundColor Cyan

# Try to find PostgreSQL service
$services = Get-Service -DisplayName "*postg*" -ErrorAction SilentlyContinue

if ($services.Count -eq 0) {
    Write-Host "❌ PostgreSQL service not found!" -ForegroundColor Red
    Write-Host "   Make sure PostgreSQL is installed" -ForegroundColor Yellow
    exit 1
}

foreach ($service in $services) {
    Write-Host "`nService: $($service.DisplayName)" -ForegroundColor White
    Write-Host "Status: $($service.Status)" -ForegroundColor Gray
    
    if ($service.Status -eq 'Running') {
        Write-Host "✅ Already running" -ForegroundColor Green
    } else {
        Write-Host "Starting..." -ForegroundColor Yellow
        Start-Service $service.Name
        Write-Host "✅ Started" -ForegroundColor Green
    }
}

Write-Host "`n✅ PostgreSQL is ready!" -ForegroundColor Green
Write-Host "   Listening on localhost:5432" -ForegroundColor Gray
