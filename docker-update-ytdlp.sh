#!/bin/bash

# Enhanced auto-update script for yt-dlp in Docker container
# This script checks for updates and updates yt-dlp if needed

set -e

echo "[yt-dlp-updater] Starting enhanced yt-dlp update process..."

# Ensure virtual environment is available
if [ -f "/opt/venv/bin/activate" ]; then
    source /opt/venv/bin/activate
    echo "[yt-dlp-updater] Virtual environment activated"
else
    echo "[yt-dlp-updater] Warning: Virtual environment not found, using system Python"
fi

# Function to get version safely
get_version() {
    yt-dlp --version 2>/dev/null || echo "unknown"
}

# Function to check if version is newer
is_newer_version() {
    local current="$1"
    local new="$2"
    
    # If either version is unknown, consider it different
    if [ "$current" = "unknown" ] || [ "$new" = "unknown" ]; then
        return 0
    fi
    
    # Simple string comparison for date-based versions
    if [ "$current" != "$new" ]; then
        return 0
    fi
    
    return 1
}

# Get current version
CURRENT_VERSION=$(get_version)
echo "[yt-dlp-updater] Current yt-dlp version: $CURRENT_VERSION"

# Check if update is available by fetching latest version info
echo "[yt-dlp-updater] Checking latest version from GitHub..."
LATEST_VERSION=""
if command -v curl >/dev/null 2>&1; then
    LATEST_VERSION=$(curl -s "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": "\([^"]*\)".*/\1/' | sed 's/^v//' 2>/dev/null || echo "unknown")
elif command -v wget >/dev/null 2>&1; then
    LATEST_VERSION=$(wget -qO- "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": "\([^"]*\)".*/\1/' | sed 's/^v//' 2>/dev/null || echo "unknown")
fi

if [ -n "$LATEST_VERSION" ] && [ "$LATEST_VERSION" != "unknown" ]; then
    echo "[yt-dlp-updater] Latest available version: $LATEST_VERSION"
    
    if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
        echo "[yt-dlp-updater] yt-dlp is already up to date ($CURRENT_VERSION)"
        exit 0
    fi
else
    echo "[yt-dlp-updater] Warning: Could not fetch latest version, proceeding with update attempt"
fi

# Try updating yt-dlp
echo "[yt-dlp-updater] Attempting to update yt-dlp..."

# Method 1: Try yt-dlp self-update with --update-to stable (bypasses GitHub API)
echo "[yt-dlp-updater] Method 1: Trying yt-dlp --update-to stable..."
if yt-dlp --update-to stable 2>/dev/null; then
    # Wait a moment for update to complete
    sleep 2
    NEW_VERSION=$(get_version)
    if is_newer_version "$CURRENT_VERSION" "$NEW_VERSION"; then
        echo "[yt-dlp-updater] Successfully updated yt-dlp from $CURRENT_VERSION to $NEW_VERSION via --update-to stable"
        exit 0
    else
        echo "[yt-dlp-updater] Update completed, version: $NEW_VERSION"
        exit 0
    fi
else
    echo "[yt-dlp-updater] --update-to stable failed, trying -U..."
    # Fallback to -U
    if yt-dlp -U 2>/dev/null; then
        sleep 2
        NEW_VERSION=$(get_version)
        echo "[yt-dlp-updater] Updated via -U to version: $NEW_VERSION"
        exit 0
    else
        echo "[yt-dlp-updater] Self-update failed"
    fi
fi

# Method 2: Use pip to update if self-update failed
echo "[yt-dlp-updater] Method 2: Trying pip update..."
if pip install --upgrade --no-cache-dir yt-dlp >/dev/null 2>&1; then
    sleep 2
    NEW_VERSION=$(get_version)
    if is_newer_version "$CURRENT_VERSION" "$NEW_VERSION"; then
        echo "[yt-dlp-updater] Successfully updated yt-dlp from $CURRENT_VERSION to $NEW_VERSION via pip"
        exit 0
    else
        echo "[yt-dlp-updater] Pip update completed, but version unchanged ($NEW_VERSION)"
    fi
else
    echo "[yt-dlp-updater] Pip update failed"
fi

# Method 3: Force reinstall as last resort
echo "[yt-dlp-updater] Method 3: Trying force reinstall..."
if pip install --force-reinstall --no-cache-dir yt-dlp >/dev/null 2>&1; then
    sleep 2
    NEW_VERSION=$(get_version)
    echo "[yt-dlp-updater] Force reinstall completed, version: $NEW_VERSION"
    exit 0
fi

echo "[yt-dlp-updater] All update methods failed"
exit 1
