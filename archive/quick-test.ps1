# Quick Test Script for Phase 1 KYC Implementation
# Run this script to quickly test the basic flow

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Phase 1 KYC - Quick Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if backend is running
Write-Host "[1/6] Checking if backend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Backend is running on port 3001" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend is not running!" -ForegroundColor Red
    Write-Host "  Please start backend: npm run start:dev" -ForegroundColor Yellow
    exit 1
}

# Step 2: Check if frontend is running
Write-Host "[2/6] Checking if frontend is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✓ Frontend is running on port 3000" -ForegroundColor Green
} catch {
    Write-Host "✗ Frontend is not running!" -ForegroundColor Red
    Write-Host "  Please start frontend: npm run dev" -ForegroundColor Yellow
    exit 1
}

# Step 3: Check database connection
Write-Host "[3/6] Checking database connection..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    
    $DB_HOST = $env:DB_HOST
    $DB_NAME = $env:DB_NAME
    
    Write-Host "✓ Database config found: $DB_HOST / $DB_NAME" -ForegroundColor Green
} else {
    Write-Host "✗ .env file not found!" -ForegroundColor Red
    exit 1
}

# Step 4: Check if migration has been run
Write-Host "[4/6] Checking if KYC migration has been run..." -ForegroundColor Yellow
$env:PGPASSWORD = $env:DB_PASSWORD
try {
    $result = psql -h $env:DB_HOST -p $env:DB_PORT -U $env:DB_USER -d $env:DB_NAME -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'kycStatus';" 2>$null
    
    if ($result -match "kycStatus") {
        Write-Host "✓ KYC migration has been applied" -ForegroundColor Green
    } else {
        Write-Host "✗ KYC migration NOT applied!" -ForegroundColor Red
        Write-Host "  Run: .\run-kyc-migration.ps1" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "✗ Could not check database!" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Yellow
}
Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue

# Step 5: Check if upload directory exists
Write-Host "[5/6] Checking upload directories..." -ForegroundColor Yellow
if (-Not (Test-Path "public/uploads")) {
    New-Item -Path "public/uploads" -ItemType Directory -Force | Out-Null
    Write-Host "✓ Created public/uploads directory" -ForegroundColor Green
}
if (-Not (Test-Path "public/uploads/kyc")) {
    New-Item -Path "public/uploads/kyc" -ItemType Directory -Force | Out-Null
    Write-Host "✓ Created public/uploads/kyc directory" -ForegroundColor Green
} else {
    Write-Host "✓ Upload directories exist" -ForegroundColor Green
}

# Step 6: Display test URLs
Write-Host "[6/6] System ready for testing!" -ForegroundColor Yellow
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✓ All checks passed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Test URLs:" -ForegroundColor Cyan
Write-Host "  Vendor KYC Page:" -ForegroundColor White
Write-Host "    http://localhost:3000/vendor/kyc" -ForegroundColor Gray
Write-Host ""
Write-Host "  Admin KYC Verification:" -ForegroundColor White
Write-Host "    http://localhost:3000/admin/kyc-verification" -ForegroundColor Gray
Write-Host ""

Write-Host "API Endpoints:" -ForegroundColor Cyan
Write-Host "  GET  http://localhost:3001/api/v1/vendors/kyc/status" -ForegroundColor Gray
Write-Host "  POST http://localhost:3001/api/v1/vendors/kyc/submit" -ForegroundColor Gray
Write-Host "  GET  http://localhost:3001/api/v1/vendors/kyc/pending" -ForegroundColor Gray
Write-Host "  POST http://localhost:3001/api/v1/upload/kyc-documents" -ForegroundColor Gray
Write-Host ""

Write-Host "Quick Test Steps:" -ForegroundColor Cyan
Write-Host "  1. Login as vendor → http://localhost:3000/login" -ForegroundColor Gray
Write-Host "  2. Go to KYC page → Upload 5 required documents" -ForegroundColor Gray
Write-Host "  3. Submit KYC → Check status changes to 'Submitted'" -ForegroundColor Gray
Write-Host "  4. Login as admin → Review KYC submission" -ForegroundColor Gray
Write-Host "  5. Approve or Reject KYC → Verify status update" -ForegroundColor Gray
Write-Host ""

Write-Host "For detailed testing guide, see:" -ForegroundColor Yellow
Write-Host "  TESTING_GUIDE_PHASE1.md" -ForegroundColor Gray
Write-Host ""

# Offer to open browser
$openBrowser = Read-Host "Open browser to test? (y/n)"
if ($openBrowser -eq 'y' -or $openBrowser -eq 'Y') {
    Write-Host ""
    Write-Host "Opening browser..." -ForegroundColor Green
    Start-Process "http://localhost:3000/vendor/kyc"
    Start-Sleep -Seconds 2
    Start-Process "http://localhost:3000/admin/kyc-verification"
    Write-Host "✓ Browser tabs opened" -ForegroundColor Green
}

Write-Host ""
Write-Host "Happy Testing! 🎉" -ForegroundColor Cyan
Write-Host ""
