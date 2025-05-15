# HivePlay

A YouTube media player built with Next.js, with Redis caching and yt-dlp integration, all packaged into a single Docker container.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- (Optional, for development) [Node.js 18+](https://nodejs.org/)
- Git (to clone the repository)

## Installation & Quick Start

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/MusabehMoh/HivePlay.git
   cd HivePlay
   ```

2. **Build and start the app with Docker Compose:**
   ```powershell
   docker-compose up -d
   ```

3. **Open your browser:**
   - On your PC: [http://localhost:3000](http://localhost:3000)
   - On your phone or another device: [http://<your-pc-ip>:3000](http://<your-pc-ip>:3000)
     - Find your PC's IP with `ipconfig` in PowerShell (look for `IPv4 Address`).
     - Make sure your firewall allows connections on port 3000.

4. **Stop the app:**
   ```powershell
   docker-compose down
   ```

For detailed Windows instructions, see [WINDOWS-GUIDE.md](WINDOWS-GUIDE.md).
For ARM devices (Khadas, Raspberry Pi, etc.), see [DOCKER-GUIDE.md](DOCKER-GUIDE.md) and use the `build-for-arm.sh` script.

## Features

- YouTube audio and video playback
- Multiple backends (yt-dlp, ytdl-core)
- Redis caching for better performance
- Responsive UI with mobile support
- Docker support for easy deployment
- ARM compatibility (Khadas, Raspberry Pi, etc.)

## Environment Variables

HivePlay uses several environment variables for configuration. Most are set automatically in Docker, but you may want to customize them for local development or advanced deployments.

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
