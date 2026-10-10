#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Deploy first-time setup to Render

.DESCRIPTION
    Commits and pushes the first-time database setup configuration
    This will DROP all tables, CREATE fresh tables, and SEED all data
#>

Write-Host "🚨 ====================================" -ForegroundColor Red
Write-Host "🚨  FIRST-TIME DEPLOYMENT WARNING" -ForegroundColor Red
Write-Host "🚨 ====================================" -ForegroundColor Red
Write-Host ""
Write-Host "This deployment will:" -ForegroundColor Yellow
Write-Host "  1. DROP all existing tables in Neon database" -ForegroundColor Red
Write-Host "  2. CREATE fresh tables from TypeORM entities" -ForegroundColor Green
Write-Host "  3. SEED all data (admin, products, categories)" -ForegroundColor Green
Write-Host "  4. Start the application" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  ALL EXISTING DATA WILL BE DELETED!" -ForegroundColor Yellow
Write-Host ""

$confirmation = Read-Host "Type 'YES' to continue with first-time setup"

if ($confirmation -ne 'YES') {
    Write-Host "❌ Deployment cancelled" -ForegroundColor Red
    exit 1
}

Write-Host "`n📦 Preparing first-time deployment..." -ForegroundColor Cyan

# Check git status
Write-Host "`n🔍 Files to be deployed:" -ForegroundColor Yellow
git status --short

Write-Host "`n📝 Adding files..." -ForegroundColor Yellow
git add render-drop-tables.js
git add render-create-tables.js
git add src/scripts/create-tables.ts
git add seed-all-render.js
git add package.json
git add render.yaml
git add RENDER_FIRST_TIME_SETUP.md

Write-Host "`n💾 Committing..." -ForegroundColor Yellow
git commit -m "feat: Render first-time database setup (drop + create + seed)

- Add render-drop-tables.js to clean slate
- Add render-create-tables.js to create fresh schema
- Add seed-all-render.js for comprehensive seeding
- Update render:start to run full setup
- Seeds admin + products (physical, tours, services)

⚠️ IMPORTANT: After first successful deployment, switch to normal mode:
   Change render:start to use render:start:normal (migrations only)
   See RENDER_FIRST_TIME_SETUP.md for details"

Write-Host "`n🚀 Pushing to remote..." -ForegroundColor Yellow
git push

Write-Host "`n✅ First-time deployment triggered!" -ForegroundColor Green
Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Go to Render Dashboard: https://dashboard.render.com" -ForegroundColor White
Write-Host "2. Select your marketplace-backend service" -ForegroundColor White
Write-Host "3. Watch deployment logs for:" -ForegroundColor White
Write-Host "   - 🗑️  Dropping tables" -ForegroundColor Gray
Write-Host "   - 🏗️  Creating tables" -ForegroundColor Gray
Write-Host "   - 🌱 Seeding data" -ForegroundColor Gray
Write-Host "4. Wait for deployment to complete (5-10 minutes)" -ForegroundColor White
Write-Host "5. Test login: admin@marketplace.com / admin123" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  AFTER FIRST SUCCESSFUL DEPLOYMENT:" -ForegroundColor Yellow
Write-Host "   Switch to normal mode to prevent data loss on future deploys!" -ForegroundColor Yellow
Write-Host "   See: RENDER_FIRST_TIME_SETUP.md" -ForegroundColor Yellow
Write-Host ""
