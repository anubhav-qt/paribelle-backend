# Redis Setup and Management Script

Write-Host "Redis Setup and Management" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Check if Redis is installed
function Test-RedisInstalled {
    $redisServer = Get-Command redis-server -ErrorAction SilentlyContinue
    $redisClient = Get-Command redis-cli -ErrorAction SilentlyContinue
    return ($null -ne $redisServer -and $null -ne $redisClient)
}

# Check if Redis is running
function Test-RedisRunning {
    try {
        $result = redis-cli ping 2>$null
        return ($result -eq "PONG")
    } catch {
        return $false
    }
}

# Main menu
$isInstalled = Test-RedisInstalled
$isRunning = Test-RedisRunning

if (-not $isInstalled) {
    Write-Host "❌ Redis is not installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Redis:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://github.com/microsoftarchive/redis/releases" -ForegroundColor Yellow
    Write-Host "2. Or use Chocolatey: choco install redis-64" -ForegroundColor Yellow
    Write-Host "3. Or use WSL: sudo apt-get install redis-server" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "✅ Redis is installed" -ForegroundColor Green

if ($isRunning) {
    Write-Host "✅ Redis is running" -ForegroundColor Green
    Write-Host ""
    
    # Show Redis stats
    Write-Host "Redis Information:" -ForegroundColor Cyan
    Write-Host "-----------------" -ForegroundColor Cyan
    
    try {
        $info = redis-cli INFO stats | Select-String -Pattern "total_commands_processed"
        Write-Host $info
        
        $keys = redis-cli DBSIZE
        Write-Host "Database size: $keys"
        
        $memory = redis-cli INFO memory | Select-String -Pattern "used_memory_human"
        Write-Host $memory
    } catch {
        Write-Host "Could not fetch Redis stats" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Redis Management Options:" -ForegroundColor Cyan
    Write-Host "1. Monitor Redis operations (redis-cli MONITOR)" -ForegroundColor White
    Write-Host "2. Show all cache keys (redis-cli KEYS *)" -ForegroundColor White
    Write-Host "3. Clear all cache (redis-cli FLUSHALL)" -ForegroundColor White
    Write-Host "4. Stop Redis server" -ForegroundColor White
    Write-Host "5. Exit" -ForegroundColor White
    Write-Host ""
    
    $choice = Read-Host "Enter choice (1-5)"
    
    switch ($choice) {
        "1" {
            Write-Host "Starting Redis monitor (Press Ctrl+C to stop)..." -ForegroundColor Yellow
            redis-cli MONITOR
        }
        "2" {
            Write-Host "Cache Keys:" -ForegroundColor Cyan
            redis-cli KEYS *
        }
        "3" {
            $confirm = Read-Host "Are you sure you want to clear ALL cache? (yes/no)"
            if ($confirm -eq "yes") {
                redis-cli FLUSHALL
                Write-Host "✅ Cache cleared" -ForegroundColor Green
            } else {
                Write-Host "Cancelled" -ForegroundColor Yellow
            }
        }
        "4" {
            Write-Host "Stopping Redis..." -ForegroundColor Yellow
            redis-cli SHUTDOWN
            Write-Host "✅ Redis stopped" -ForegroundColor Green
        }
        "5" {
            Write-Host "Exiting..." -ForegroundColor Cyan
            exit 0
        }
        default {
            Write-Host "Invalid choice" -ForegroundColor Red
        }
    }
} else {
    Write-Host "⚠️  Redis is not running" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Starting Redis server..." -ForegroundColor Cyan
    Write-Host ""
    
    # Try to start Redis
    try {
        Start-Process -FilePath "redis-server" -WindowStyle Normal
        Start-Sleep -Seconds 2
        
        if (Test-RedisRunning) {
            Write-Host "✅ Redis started successfully" -ForegroundColor Green
            Write-Host ""
            Write-Host "Redis is now running on:" -ForegroundColor Cyan
            Write-Host "  Host: localhost" -ForegroundColor White
            Write-Host "  Port: 6379" -ForegroundColor White
            Write-Host ""
            Write-Host "You can now start your application." -ForegroundColor Green
        } else {
            Write-Host "❌ Failed to start Redis" -ForegroundColor Red
            Write-Host "Please start Redis manually: redis-server" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ Error starting Redis: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Try starting manually:" -ForegroundColor Yellow
        Write-Host "  redis-server" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
