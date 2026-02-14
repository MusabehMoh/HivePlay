# 🚀 Quick Start Guide

## One-Command Docker Setup

No environment files needed! Just run:

```bash
docker-compose up -d
```

That's it! 🎉

## What It Does

- ✅ Builds HivePlay app
- ✅ Starts Redis cache
- ✅ Sets up networking
- ✅ Configures everything automatically
- ✅ Runs health checks

## Access Your App

Open your browser: **http://localhost:3000**

## Useful Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild (after code changes)
docker-compose build
docker-compose up -d

# Clean start (remove old data)
docker-compose down -v
docker-compose up -d
```

## Optional Configuration

If you want to customize settings, create a `.env` file:

```bash
# Copy the example
cp .env.example .env

# Edit with your settings
# Then restart
docker-compose restart
```

But **you don't need to** - it works out of the box!

## Testing on Another PC

```bash
# 1. Clone the repo
git clone https://github.com/MusabehMoh/HivePlay.git
cd HivePlay

# 2. Run it (that's all!)
docker-compose up -d

# 3. Open browser
# http://localhost:3000
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 3000
netstat -ano | findstr :3000

# Or change port in docker-compose.yml:
ports:
  - "3001:3000"  # Use 3001 instead
```

### Container Won't Start
```bash
# View logs
docker-compose logs -f app

# Force rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Reset Everything
```bash
# Nuclear option - removes all data and containers
docker-compose down -v
docker system prune -a
docker-compose up -d
```

---

**That's it! No env files, no complicated setup. Just one command.** 🚀
