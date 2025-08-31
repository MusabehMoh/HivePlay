#!/bin/bash

# Auto-update script for yt-dlp in Docker container
# This script checks for updates and updates yt-dlp if needed

set -e

echo "[yt-dlp-updater] Checking for yt-dlp updates..."

# Ensure virtual environment is available
source /opt/venv/bin/activate

# Get current version
CURRENT_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
echo "[yt-dlp-updater] Current yt-dlp version: $CURRENT_VERSION"

# Try to update yt-dlp
echo "[yt-dlp-updater] Attempting to update yt-dlp..."

# Method 1: Try yt-dlp self-update first
if yt-dlp -U 2>/dev/null; then
    NEW_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
    if [ "$CURRENT_VERSION" != "$NEW_VERSION" ]; then
        echo "[yt-dlp-updater] Successfully updated yt-dlp from $CURRENT_VERSION to $NEW_VERSION"
    else
        echo "[yt-dlp-updater] yt-dlp is already up to date ($CURRENT_VERSION)"
    fi
    exit 0
fi

# Method 2: Use pip to update if self-update failed
echo "[yt-dlp-updater] Self-update failed, trying pip update..."
if pip install --upgrade --no-cache-dir yt-dlp; then
    NEW_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
    echo "[yt-dlp-updater] Updated yt-dlp via pip from $CURRENT_VERSION to $NEW_VERSION"
    exit 0
fi

echo "[yt-dlp-updater] Failed to update yt-dlp"
exit 1
