# HivePlay Startup Script for Windows
# Starts the PO Token server (bgutil) and the Next.js dev server

$ErrorActionPreference = "Continue"

$POT_SERVER_PATH = "C:\Users\USER\bgutil-ytdlp-pot-provider\server\build\main.js"
$POT_PORT = 4416

Write-Host "=== HivePlay Startup ===" -ForegroundColor Cyan

# 1. Check if PO Token server is already running
$potRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$POT_PORT/ping" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] PO Token server already running" -ForegroundColor Green
        $potRunning = $true
    }
} catch {
    Write-Host "[..] PO Token server not running, starting it..." -ForegroundColor Yellow
}

# 2. Start PO Token server if not running
if (-not $potRunning) {
    if (Test-Path $POT_SERVER_PATH) {
        $proc = Start-Process -FilePath "node" -ArgumentList $POT_SERVER_PATH -PassThru -WindowStyle Minimized
        Write-Host "[OK] PO Token server started (PID: $($proc.Id))" -ForegroundColor Green
        # Wait for it to be ready
        $ready = $false
        for ($i = 0; $i -lt 15; $i++) {
            Start-Sleep -Seconds 1
            try {
                $r = Invoke-WebRequest -Uri "http://127.0.0.1:$POT_PORT/ping" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                if ($r.StatusCode -eq 200) {
                    Write-Host "[OK] PO Token server ready" -ForegroundColor Green
                    $ready = $true
                    break
                }
            } catch { }
        }
        if (-not $ready) {
            Write-Host "[WARN] PO Token server may not be ready yet, continuing anyway..." -ForegroundColor Yellow
        }
    } else {
        Write-Host "[WARN] PO Token server not found at $POT_SERVER_PATH" -ForegroundColor Yellow
        Write-Host "       yt-dlp may fail with bot detection without it" -ForegroundColor Yellow
    }
}

# 3. Check Redis
try {
    $redisTest = & redis-cli ping 2>$null
    if ($redisTest -eq "PONG") {
        Write-Host "[OK] Redis is running" -ForegroundColor Green
    } else {
        Write-Host "[WARN] Redis not responding" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARN] Redis not found - audio caching will be disabled" -ForegroundColor Yellow
}

# 4. Check yt-dlp
$ytdlp = Join-Path $PSScriptRoot "yt-dlp.exe"
if (Test-Path $ytdlp) {
    $ver = & $ytdlp --version 2>$null
    Write-Host "[OK] yt-dlp version: $ver" -ForegroundColor Green
} else {
    Write-Host "[WARN] yt-dlp.exe not found in project directory" -ForegroundColor Yellow
}

# 5. Check cookies.txt
$cookies = Join-Path $PSScriptRoot "cookies.txt"
if (Test-Path $cookies) {
    Write-Host "[OK] cookies.txt found" -ForegroundColor Green
} else {
    Write-Host "[INFO] No cookies.txt - using browser cookies or none" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting Next.js dev server..." -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 6. Start Next.js
npm run dev
