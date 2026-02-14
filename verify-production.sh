#!/bin/bash

# HivePlay Production Readiness Verification Script
# Tests all critical systems before deployment

echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║         🚀 HivePlay Production Readiness Verification 🚀                    ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

ERRORS=0
WARNINGS=0

# Function to check success
check() {
    if [ $? -eq 0 ]; then
        echo "✅ $1"
    else
        echo "❌ $1 FAILED"
        ((ERRORS++))
    fi
}

# Function to warn
warn() {
    echo "⚠️  $1"
    ((WARNINGS++))
}

echo "📦 1. Checking Dependencies..."
echo "--------------------------------"

# Check if yt-dlp is installed
if command -v yt-dlp &> /dev/null; then
    VERSION=$(yt-dlp --version)
    echo "✅ yt-dlp installed (version: $VERSION)"
else
    echo "❌ yt-dlp not found"
    ((ERRORS++))
fi

# Check if ffmpeg is installed
if command -v ffmpeg &> /dev/null; then
    echo "✅ ffmpeg installed"
else
    warn "ffmpeg not found (optional, needed for canvas)"
fi

# Check if Node.js is installed
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js installed ($NODE_VERSION)"
else
    echo "❌ Node.js not found"
    ((ERRORS++))
fi

echo ""
echo "🐳 2. Checking Docker Configuration..."
echo "---------------------------------------"

# Check if Docker is available
if command -v docker &> /dev/null; then
    echo "✅ Docker installed"
    
    # Check if docker-compose is available
    if command -v docker-compose &> /dev/null; then
        echo "✅ docker-compose installed"
    else
        warn "docker-compose not found"
    fi
else
    warn "Docker not installed (optional for containerized deployment)"
fi

# Check Docker files
if [ -f "Dockerfile" ]; then
    echo "✅ Dockerfile found"
else
    echo "❌ Dockerfile missing"
    ((ERRORS++))
fi

if [ -f "docker-compose.yml" ]; then
    echo "✅ docker-compose.yml found"
else
    warn "docker-compose.yml missing"
fi

if [ -f "docker-update-ytdlp.sh" ]; then
    echo "✅ docker-update-ytdlp.sh found"
else
    echo "❌ docker-update-ytdlp.sh missing"
    ((ERRORS++))
fi

echo ""
echo "📁 3. Checking Project Structure..."
echo "------------------------------------"

# Check critical files
FILES=(
    "package.json"
    "next.config.mjs"
    "tsconfig.json"
    "src/app/api/alternative/playback/hybridStream/route.ts"
    "src/app/api/canvas/route.ts"
    "src/app/services/alternative/yt-dlp-updater.ts"
    "src/app/services/alternative/yt-dlp-health.ts"
    "src/app/services/alternative/yt-dlp-nightly.ts"
    "src/app/services/alternative/ytdlp-locator.ts"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file missing"
        ((ERRORS++))
    fi
done

echo ""
echo "📚 4. Checking Documentation..."
echo "--------------------------------"

DOCS=(
    "README.md"
    "DOCKER-GUIDE.md"
    "PERMANENT-SOLUTION.md"
    "YT-DLP-MAINTENANCE.md"
    "PRODUCTION-READY.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo "✅ $doc"
    else
        warn "$doc missing"
    fi
done

echo ""
echo "🔧 5. Checking Configuration..."
echo "--------------------------------"

# Check if .env.local exists (optional)
if [ -f ".env.local" ]; then
    echo "✅ .env.local found"
else
    warn ".env.local not found (optional)"
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo "✅ node_modules installed"
else
    warn "node_modules missing - run 'npm install'"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                           VERIFICATION RESULTS                               ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ]; then
    echo "✅ ALL CRITICAL CHECKS PASSED!"
    echo ""
    echo "🎉 System is PRODUCTION READY!"
    echo ""
    echo "Next steps:"
    echo "  1. Run 'npm install' if node_modules is missing"
    echo "  2. Run 'npm run build' to build the application"
    echo "  3. Run 'npm start' for production mode"
    echo "  Or:"
    echo "  1. Run 'docker-compose build' to build Docker image"
    echo "  2. Run 'docker-compose up -d' to start in Docker"
    echo ""
    exit 0
else
    echo "❌ FOUND $ERRORS CRITICAL ERRORS"
    if [ $WARNINGS -gt 0 ]; then
        echo "⚠️  Found $WARNINGS warnings"
    fi
    echo ""
    echo "Please fix the errors above before deploying to production."
    echo ""
    exit 1
fi
