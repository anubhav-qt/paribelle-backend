# Add Footer Templates Script
# This script adds predefined page templates to footer settings

param(
    [switch]$Replace,
    [switch]$Merge
)

Write-Host "📋 Adding footer page templates..." -ForegroundColor Cyan
Write-Host ""

# Build the command
$command = "node add-footer-templates.js"

if ($Replace) {
    $command += " --replace"
    Write-Host "Mode: Replace existing sections" -ForegroundColor Yellow
} elseif ($Merge) {
    $command += " --merge"
    Write-Host "Mode: Merge with existing sections" -ForegroundColor Yellow
}

Write-Host ""

# Run the script
try {
    Invoke-Expression $command
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✨ Done!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Script failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}
