# HivePlay 🎵

A modern YouTube music streaming platform built with Next.js, featuring advanced search suggestions with thumbnails, Redis caching, and yt-dlp integration for high-quality audio streaming.

![HivePlay](https://img.shields.io/badge/HivePlay-Music_Streaming-green?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15.3-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)

## ✨ Features

### 🎵 **Core Music Experience**
- **High-Quality Audio Streaming** - Powered by yt-dlp with fallback to ytdl-core
- **Smart Search** - Intelligent search suggestions with real thumbnails
- **Audio Player** - Modern player with progress tracking and controls
- **Playlist Management** - Create and manage custom playlists
- **Recent Searches** - Quick access to your recent music searches

### 🖼️ **Visual Search Suggestions**
- **Real Thumbnails** - Display actual YouTube video thumbnails in suggestions
- **Smart Categorization** - Artists, songs, and generic suggestions with type indicators
- **Visual Icons** - Color-coded icons (🎤 Artists, 🎵 Songs, 🔍 Generic)
- **Duplicate Prevention** - Intelligent filtering to avoid duplicate suggestions

### ⚡ **Performance & Caching**
- **Redis Caching** - 1-week audio cache for instant playback
- **Search Cache** - 5-minute suggestion caching for faster responses
- **Optimized Streaming** - Range request support for efficient audio delivery
- **Background Processing** - Non-blocking audio downloads and caching

### 🎨 **Modern UI/UX**
- **Spotify-Inspired Design** - Dark theme with green accents
- **Responsive Layout** - Works perfectly on desktop, tablet, and mobile
- **Keyboard Navigation** - Arrow keys and Enter support in suggestions
- **Loading States** - Beautiful loading animations and progress indicators

### 🐳 **Deployment Ready**
- **Docker Support** - Complete containerization with docker-compose
- **ARM Compatibility** - Khadas, Raspberry Pi, and other ARM devices
- **Production Optimized** - Multi-stage builds and security best practices
- **Easy Setup** - One-command deployment with Docker Compose

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- (Optional, for development) [Node.js 20+](https://nodejs.org/)
- Git (to clone the repository)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/MusabehMoh/HivePlay.git
   cd HivePlay
   ```

2. **Build and start with Docker Compose:**
   ```bash
   docker-compose up -d
   ```

3. **Access HivePlay:**
   - **Local:** [http://localhost:3000](http://localhost:3000)
   - **Network:** `http://<your-ip>:3000` (find IP with `ipconfig` on Windows)

4. **Stop the application:**
   ```bash
   docker-compose down
   ```

## 🛠️ Development Setup

For local development without Docker:

```bash
# Install dependencies
npm install

# Start Redis (required for caching)
docker run -d -p 6379:6379 redis:alpine

# Start development server
npm run dev
```

## 📱 Usage

### Search & Discovery
1. **Type** in the search box to see real-time suggestions with thumbnails
2. **Click** on suggestions or press Enter to search
3. **Browse** results with beautiful thumbnails and metadata
4. **Play** any track with one click

### Playlists
1. **Create** playlists from the sidebar
2. **Add songs** using the + button on any track
3. **Manage** playlists with edit/delete options
4. **Play** entire playlists seamlessly

### Audio Features
- **High-Quality Streaming** - Automatic quality selection
- **Progress Tracking** - See playback progress and duration
- **Caching** - Songs load instantly after first play
- **Range Requests** - Efficient streaming with seeking support

### Main Variables

- `REDIS_URL` (default: `redis://redis:6379`)
  - The Redis connection string. Set automatically in Docker Compose. For local dev, you can use `redis://localhost:6379`.
- `REDIS_HOST` (default: `localhost`)
  - Hostname for Redis (used in `.env.local` for local dev).
- `REDIS_PORT` (default: `6379`)
  - Port for Redis (used in `.env.local` for local dev).
- `REDIS_PASSWORD` (optional)
  - Password for Redis if authentication is enabled.
- `REDIS_TTL` (default: `3600`)
  - Cache time-to-live in seconds (1 hour by default).
- `REDIS_MAX_MEMORY` (default: `100`)
  - Maximum Redis memory in MB (for local dev/testing).
- `NEXT_PUBLIC_YOUTUBE_API_KEY` (optional)
  - YouTube Data API v3 key. Required only if you want to use the YouTube API directly (for higher quota or extra features). See `.env.local` for setup instructions.

### How to Use

- **Docker Compose:**
  - The `REDIS_URL` is set automatically. You can override or add more variables in `docker-compose.yml` under the `environment:` section.
- **Local Development:**
  - Copy `.env.local` to `.env.local` (if not present) and edit as needed:
    ```bash
    cp .env.local.example .env.local
    # or just edit .env.local directly
    ```
  - Set your YouTube API key if you want to use the YouTube Data API.

### Security Note
- **Never commit secrets or real API keys to your public repository.**
- The provided `.env.local` is for example/demo purposes only.

## Development Mode (Alternative)

If you prefer to run the development server directly:

```powershell
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Requirements

- Docker and Docker Compose (for containerized deployment)
- Node.js 18+ (only for local development)
- yt-dlp (installed automatically in Docker)
- Redis (included in Docker)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp) - learn about yt-dlp features and options.
- [Redis Documentation](https://redis.io/documentation) - learn about Redis.

## Troubleshooting

- If you can't access the app from another device, check your firewall settings and ensure Docker is running.
- If port 3000 is in use, change the port mapping in `docker-compose.yml`.
- For more help, see the detailed guides or open an issue on GitHub.
