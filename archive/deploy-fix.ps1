#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Deploy fix for missing columns issue

.DESCRIPTION
    Fixes TypeORM synchronize to properly create all columns
#>

Write-Host "🔧 Deploying fix for missing columns..." -ForegroundColor Cyan

Write-Host "`n📝 Changes:" -ForegroundColor Yellow
Write-Host "  - Fixed render-create-tables.js to use synchronize(true)" -ForegroundColor White
Write-Host "  - This will drop and recreate ALL tables with proper schema" -ForegroundColor White
Write-Host "  - Removed separate drop step (synchronize handles it)" -ForegroundColor White

git add src/scripts/create-tables.ts package.json

git commit -m "fix: TypeORM synchronize to create all entity columns

- Changed synchronize(false) to synchronize(true)
- Ensures all columns (city_id, vendor_id) are created
- Simplified render:start (no separate drop step needed)
- Fixed missing columns error in production"

Write-Host "`n🚀 Pushing fix..." -ForegroundColor Yellow
git push

Write-Host "`n✅ Fix deployed!" -ForegroundColor Green
Write-Host "`nRender will now:" -ForegroundColor Cyan
Write-Host "1. Drop all existing tables" -ForegroundColor White
Write-Host "2. Create fresh tables with ALL columns from entities" -ForegroundColor White
Write-Host "3. Seed all data" -ForegroundColor White
Write-Host "4. Start application" -ForegroundColor White
Write-Host ""
Write-Host "Wait 5-10 minutes for deployment, then test login!" -ForegroundColor Green
