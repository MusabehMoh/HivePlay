# HivePlay 🎵

A modern YouTube music streaming platform built with Next.js, featuring a Spotify-style UI, Snapcast multi-room audio casting, Redis caching, and yt-dlp integration for high-quality audio streaming.

![HivePlay](https://img.shields.io/badge/HivePlay-Music_Streaming-green?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15.3-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=for-the-badge&logo=typescript)
![Docker](https://img.shields.io/badge/Docker-Ready-blue?style=for-the-badge&logo=docker)

## ✨ Features

### 🎵 **Core Music Experience**
- **High-Quality Audio Streaming** — Powered by yt-dlp with automatic fallbacks
- **Spotify-Style Player** — Full-featured bottom bar with album art, progress, and controls
- **Smart Search** — Real-time suggestions with thumbnails, artist/song categorization
- **Playlist Management** — Create, edit, and play custom playlists
- **Mobile & Desktop** — Responsive layout with fullscreen Now Playing view on mobile

### 🔊 **Multi-Room Casting (Snapcast)**
- **Cast to any room** — Stream audio to Snapcast-connected speakers
- **Per-zone volume** — Control volume for each speaker independently
- **Instant seek** — Seeking while casting is fast with TCP reconnect (~300ms)
- **Pause/resume** — Clean audio transitions with no white noise or artifacts
- **Works with any Snapcast setup** — OrangePi, Raspberry Pi, Linux desktop, etc.

### ⚡ **Performance & Caching**
- **Redis Caching** — 1-week audio cache for instant playback
- **In-Memory Cache** — Last 5 tracks cached in RAM for instant seek (0ms)
- **Optimized Streaming** — Range request support for efficient audio delivery
- **Background Processing** — Non-blocking audio downloads and caching

### 🎨 **Modern UI/UX**
- **Spotify-Inspired Design** — Dark theme with green accents (#1DB954)
- **Responsive Layout** — Desktop bottom bar, mobile fullscreen player
- **Device Picker** — Inline cast device selector (like Spotify Connect)
- **Loading States** — Smooth loading animations and progress indicators

### 🐳 **Deployment Ready**
- **Docker Support** — One-command setup with docker-compose
- **ARM Compatibility** — Raspberry Pi, OrangePi, and other ARM devices
- **Production Optimized** — Multi-stage builds, non-root user, health checks
- **Zero Config** — Works out of the box; casting is optional

## 🚀 Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- Git

### Installation

1. **Clone and start:**
   ```bash
   git clone https://github.com/MusabehMoh/HivePlay.git
   cd HivePlay
   docker-compose up -d
   ```

2. **Open HivePlay:**
   - **Local:** [http://localhost:3000](http://localhost:3000)
   - **Network:** `http://<your-ip>:3000`

3. **Stop:**
   ```bash
   docker-compose down
   ```

### Enable Multi-Room Casting (Optional)

If you have a [Snapcast](https://github.com/badaix/snapcast) server running on your network:

1. **Set the Snapcast host** in `docker-compose.yml` or a `.env` file:
   ```bash
   SNAPCAST_HOST=192.168.0.100
   ```

2. **Restart:**
   ```bash
   docker-compose up -d
   ```

3. **Click the cast icon** 🔊 in the player to start streaming to your speakers.

> **Snapcast setup:** Install `snapserver` on any Linux device (OrangePi, Raspberry Pi, etc.) and configure a TCP source:
> ```
> source = tcp://0.0.0.0:4953?name=HivePlay&mode=server&sampleformat=44100:16:2&codec=flac
> ```
> Install `snapclient` on each speaker device. See the [Snapcast docs](https://github.com/badaix/snapcast) for details.

## 🛠️ Development Setup

For local development without Docker:

```bash
# Install dependencies
npm install

# Start Redis (required for caching)
docker run -d -p 6379:6379 redis:alpine

# (Optional) Set Snapcast host for casting
# Create .env.local with: SNAPCAST_HOST=192.168.0.100

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## ⚙️ Configuration

All settings can be configured via environment variables. See [.env.example](.env.example) for the full list.

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | `redis://redis:6379` | Redis connection string |
| `SNAPCAST_HOST` | *(empty — disabled)* | Snapcast server IP for multi-room casting |
| `SNAPCAST_TCP_PORT` | `4953` | Snapcast TCP stream input port |
| `SNAPCAST_PORT` | `1705` | Snapcast JSON-RPC control port |
| `YTDLP_AUTO_UPDATE` | `true` | Auto-update yt-dlp on startup |
| `NEXT_PUBLIC_YOUTUBE_API_KEY` | *(empty)* | Optional YouTube Data API v3 key |

## 📱 Usage

### Search & Play
1. Type in the search box for real-time suggestions with thumbnails
2. Click any result to start playing
3. Use the bottom bar for playback controls

### Cast to Speakers
1. Click the **cast icon** (🔊) in the player
2. Select your Snapcast zone from the device picker
3. Adjust per-room volume with the sliders
4. Seek, pause, and skip — audio stays in sync

### Playlists
1. Create playlists from the sidebar
2. Add songs with the **+** button
3. Play entire playlists seamlessly

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│  Next.js API  │────▶│    Redis     │
│  (React UI)  │◀────│  (yt-dlp +   │◀────│  (audio      │
│              │     │   ffmpeg)     │     │   cache)     │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Snapcast    │  (optional)
                    │  Server      │
                    │  (TCP 4953)  │
                    └──────┬───────┘
                    ┌──────▼───────┐
                    │  Speakers    │
                    │  (snapclient)│
                    └──────────────┘
```

## Requirements

- **Docker** and Docker Compose (for containerized deployment)
- **Node.js 20+** (only for local development)
- **yt-dlp** — installed automatically in Docker
- **Redis** — included in Docker Compose
- **Snapcast** — optional, for multi-room casting

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp)
- [Snapcast Documentation](https://github.com/badaix/snapcast)
- [Redis Documentation](https://redis.io/documentation)

## Troubleshooting

- **Can't access from another device?** Check firewall settings and ensure port 3000 is open.
- **Cast not working?** Verify `SNAPCAST_HOST` is set and the Snapcast server is reachable.
- **Audio not playing?** Redis must be running. Check with `docker ps`.
- **yt-dlp errors?** The app auto-updates yt-dlp. Restart the container if issues persist.
