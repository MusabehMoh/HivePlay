#!/bin/bash

# HIVEPLAY Startup Banner
echo ""
echo "╔══════════════════════════════════════════════════════════════════════════════╗"
echo "║                                                                              ║"
echo "║  ██╗  ██╗██╗██╗   ██╗███████╗██████╗ ██╗      █████╗ ██╗   ██╗             ║"
echo "║  ██║  ██║██║██║   ██║██╔════╝██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝             ║"
echo "║  ███████║██║██║   ██║█████╗  ██████╔╝██║     ███████║ ╚████╔╝              ║"
echo "║  ██╔══██║██║╚██╗ ██╔╝██╔══╝  ██╔═══╝ ██║     ██╔══██║  ╚██╔╝               ║"
echo "║  ██║  ██║██║ ╚████╔╝ ███████╗██║     ███████╗██║  ██║   ██║                ║"
echo "║  ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝                ║"
echo "║                                                                              ║"
echo "║              🎵 YouTube Music Streaming Platform 🎵                         ║"
echo "║                                                                              ║"
echo "║  📱 Web Interface: http://localhost:3000                                     ║"
echo "║  🎧 Features: Search, Stream, Cache, Schedule                                ║"
echo "║  ⚡ Status: Starting application...                                          ║"
echo "║                                                                              ║"
echo "╚══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Starting HIVEPLAY server..."
echo "📦 Environment: $NODE_ENV"
echo "🗄️  Redis URL: $REDIS_URL"
echo "🎵 yt-dlp version: $(yt-dlp --version 2>/dev/null || echo 'Not found')"
echo ""

# Start the application
exec npm start