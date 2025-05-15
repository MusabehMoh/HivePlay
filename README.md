# HivePlay

A YouTube media player built with Next.js, with Redis caching and yt-dlp integration, all packaged into a single Docker container.

## Getting Started

### Docker Deployment (Recommended)

This project is fully dockerized, including Redis and yt-dlp, making it easy to deploy anywhere.

#### On Windows PC

```powershell
# Build and start all containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all containers
docker-compose down
```

For detailed Windows instructions, see [WINDOWS-GUIDE.md](WINDOWS-GUIDE.md).

#### For Khadas or other ARM devices

Use the specialized ARM build script:

```bash
chmod +x build-for-arm.sh
./build-for-arm.sh
docker-compose up -d
```

For detailed Docker instructions, see [DOCKER-GUIDE.md](DOCKER-GUIDE.md).

### Development Mode (Alternative)

If you prefer to run the development server directly:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

- YouTube audio and video playback
- Multiple backends (yt-dlp, ytdl-core)
- Redis caching for better performance
- Responsive UI with mobile support
- Docker support for easy deployment
- ARM compatibility (Khadas, Raspberry Pi, etc.)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp) - learn about yt-dlp features and options.
- [Redis Documentation](https://redis.io/documentation) - learn about Redis.

## Requirements

- Docker and Docker Compose (for containerized deployment)
- Node.js 18+ (only for local development)
- yt-dlp (installed automatically in Docker)
- Redis (included in Docker)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
