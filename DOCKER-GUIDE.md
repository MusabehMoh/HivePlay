# HivePlay Docker Guide

This guide explains how to run HivePlay using Docker, which includes all necessary components (Next.js app, Redis cache, and yt-dlp) in one package.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Building and Running

### For Windows PC

```powershell
# Navigate to the project directory
cd HivePlay

# Build and start the containers
docker-compose up -d

# The application will be available at http://localhost:3000
```

### For ARM-based Systems (Khadas)

Khadas devices use ARM architecture, which requires a slight modification to the build process.

```bash
# Navigate to the project directory
cd HivePlay

# Build the images specifically for ARM
docker-compose build --no-cache

# Start the containers
docker-compose up -d

# The application will be available at http://localhost:3000
```

## Accessing the Application

Once the containers are running:

- Web Interface: http://localhost:3000
- Redis (if you need direct access): localhost:6379

## Stopping the Application

```powershell
# Stop the containers
docker-compose down

# If you want to remove the volumes as well
docker-compose down -v
```

## Checking Logs

```powershell
# View logs from all containers
docker-compose logs

# View logs from a specific container
docker-compose logs app
docker-compose logs redis

# Follow the logs (live updates)
docker-compose logs -f
```

## Troubleshooting

### yt-dlp is not working

You can check if yt-dlp is correctly installed in the container:

```powershell
docker-compose exec app yt-dlp --version
```

### Redis connection issues

If the application has trouble connecting to Redis:

```powershell
# Check if Redis container is running
docker-compose ps

# Check Redis logs
docker-compose logs redis
```

### Persistent Storage

The Redis data is stored in a Docker volume called `redis-data`. This ensures your cached data persists even when containers are restarted.

## Notes for Khadas Users

- Ensure your Khadas device has enough RAM (at least 2GB recommended)
- The initial build might take longer on ARM devices
- Consider adding a cooling solution if you plan to run this 24/7
