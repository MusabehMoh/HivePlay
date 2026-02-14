# HivePlay Production Readiness Verification Script (PowerShell)
# Tests all critical systems before deployment

Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                                              ║" -ForegroundColor Cyan
Write-Host "║         🚀 HivePlay Production Readiness Verification 🚀                    ║" -ForegroundColor Cyan
Write-Host "║                                                                              ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ERRORS = 0
$WARNINGS = 0

function Check-Success {
    param($Message, $Success)
    if ($Success) {
        Write-Host "✅ $Message" -ForegroundColor Green
    } else {
        Write-Host "❌ $Message FAILED" -ForegroundColor Red
        $script:ERRORS++
    }
}

function Show-Warning {
    param($Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
    $script:WARNINGS++
}

Write-Host "📦 1. Checking Dependencies..." -ForegroundColor White
Write-Host "--------------------------------" -ForegroundColor Gray

# Check yt-dlp
try {
    $version = yt-dlp --version 2>$null
    Write-Host "✅ yt-dlp installed (version: $version)" -ForegroundColor Green
} catch {
    Write-Host "❌ yt-dlp not found" -ForegroundColor Red
    $ERRORS++
}

# Check ffmpeg
try {
    ffmpeg -version *>$null
    Write-Host "✅ ffmpeg installed" -ForegroundColor Green
} catch {
    Show-Warning "ffmpeg not found - optional, needed for canvas"
}

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js installed ($nodeVersion)" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found" -ForegroundColor Red
    $ERRORS++
}

Write-Host ""
Write-Host "🐳 2. Checking Docker Configuration..." -ForegroundColor White
Write-Host "---------------------------------------" -ForegroundColor Gray

# Check Docker
try {
    docker --version *>$null
    Write-Host "✅ Docker installed" -ForegroundColor Green
    
    try {
        docker-compose --version *>$null
        Write-Host "✅ docker-compose installed" -ForegroundColor Green
    } catch {
        Show-Warning "docker-compose not found"
    }
} catch {
    Show-Warning "Docker not installed - optional for containerized deployment"
}

# Check Docker files
if (Test-Path "Dockerfile") {
    Write-Host "✅ Dockerfile found" -ForegroundColor Green
} else {
    Write-Host "❌ Dockerfile missing" -ForegroundColor Red
    $ERRORS++
}

if (Test-Path "docker-compose.yml") {
    Write-Host "✅ docker-compose.yml found" -ForegroundColor Green
} else {
    Show-Warning "docker-compose.yml missing"
}

if (Test-Path "docker-update-ytdlp.sh") {
    Write-Host "✅ docker-update-ytdlp.sh found" -ForegroundColor Green
} else {
    Write-Host "❌ docker-update-ytdlp.sh missing" -ForegroundColor Red
    $ERRORS++
}

Write-Host ""
Write-Host "📁 3. Checking Project Structure..." -ForegroundColor White
Write-Host "------------------------------------" -ForegroundColor Gray

$FILES = @(
    "package.json",
    "next.config.mjs",
    "tsconfig.json",
    "src\app\api\alternative\playback\hybridStream\route.ts",
    "src\app\api\canvas\route.ts",
    "src\app\services\alternative\yt-dlp-updater.ts",
    "src\app\services\alternative\yt-dlp-health.ts",
    "src\app\services\alternative\yt-dlp-nightly.ts",
    "src\app\services\alternative\ytdlp-locator.ts"
)

foreach ($file in $FILES) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file missing" -ForegroundColor Red
        $ERRORS++
    }
}

Write-Host ""
Write-Host "📚 4. Checking Documentation..." -ForegroundColor White
Write-Host "--------------------------------" -ForegroundColor Gray

$DOCS = @(
    "README.md",
    "DOCKER-GUIDE.md",
    "PERMANENT-SOLUTION.md",
    "YT-DLP-MAINTENANCE.md",
    "PRODUCTION-READY.md"
)

foreach ($doc in $DOCS) {
    if (Test-Path $doc) {
        Write-Host "✅ $doc" -ForegroundColor Green
    } else {
        Show-Warning "$doc missing"
    }
}

Write-Host ""
Write-Host "🔧 5. Checking Configuration..." -ForegroundColor White
Write-Host "--------------------------------" -ForegroundColor Gray

if (Test-Path ".env.local") {
    Write-Host "✅ .env.local found" -ForegroundColor Green
} else {
    Show-Warning ".env.local not found - optional"
}

if (Test-Path "node_modules") {
    Write-Host "✅ node_modules installed" -ForegroundColor Green
} else {
    Show-Warning "node_modules missing - run npm install"
}

# Check yt-dlp version in project root
if (Test-Path "yt-dlp.exe") {
    $localVersion = .\yt-dlp.exe --version
    Write-Host "✅ Project yt-dlp.exe version: $localVersion" -ForegroundColor Green
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                           VERIFICATION RESULTS                               ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($ERRORS -eq 0) {
    Write-Host "✅ ALL CRITICAL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🎉 System is PRODUCTION READY!" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "  1. Run 'npm install' if node_modules is missing" -ForegroundColor Gray
    Write-Host "  2. Run 'npm run build' to build the application" -ForegroundColor Gray
    Write-Host "  3. Run 'npm start' for production mode" -ForegroundColor Gray
    Write-Host "  Or:" -ForegroundColor Gray
    Write-Host "  1. Run 'docker-compose build' to build Docker image" -ForegroundColor Gray
    Write-Host "  2. Run 'docker-compose up -d' to start in Docker" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ FOUND $ERRORS CRITICAL ERRORS" -ForegroundColor Red
    if ($WARNINGS -gt 0) {
        Write-Host "⚠️  Found $WARNINGS warnings" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Please fix the errors above before deploying to production." -ForegroundColor Red
    Write-Host ""
    exit 1
}
