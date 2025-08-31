# Running HivePlay on Windows

This guide provides step-by-step instructions for running HivePlay using Docker on Windows.

## Prerequisites

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. Ensure Docker is running (check for the Docker icon in your system tray)

## Running HivePlay

1. Open PowerShell or Command Prompt
2. Navigate to your HivePlay directory:
   ```powershell
   cd path\to\HivePlay
   ```

3. Build and run the Docker containers:
   ```powershell
   docker-compose up -d
   ```

4. Access HivePlay in your web browser:
   ```
   http://localhost:3000
   ```

## Managing HivePlay

### Checking status
```powershell
docker-compose ps
```

### Viewing logs
```powershell
docker-compose logs -f
```

### Stopping HivePlay
```powershell
docker-compose down
```

### Restarting HivePlay
```powershell
docker-compose restart
```

## Troubleshooting

### Issue: Port already in use
If port 3000 is already being used, you can change the port in the docker-compose.yml file:
```yaml
ports:
  - "3001:3000"  # Change 3001 to any available port
```

### Issue: Docker containers not starting
Check Docker Desktop is running and view the logs for more details:
```powershell
docker-compose logs
```

### Issue: ESLint errors during build
If you're encountering ESLint errors during the build process, you can:

1. Bypass ESLint during build:
   ```powershell
   # Create or modify .env file to skip ESLint
   echo "NEXT_SKIP_ESLINT=1" >> .env
   
   # Rebuild the Docker containers
   docker-compose up -d --build
   ```

2. Or, for a quick fix, modify your package.json:
   ```powershell
   # Modify the build command in package.json
   (Get-Content package.json) -replace '"build": "next build"', '"build": "next build --no-lint"' | Set-Content package.json
   
   # Rebuild the Docker containers
   docker-compose up -d --build
   ```

### Issue: Cannot connect to Docker daemon
Ensure Docker Desktop is running. You may need to restart it or your computer.

## Updating HivePlay

To update HivePlay when new code is available:

```powershell
# Stop the current containers
docker-compose down

# Pull the latest code (if using Git)
git pull

# Rebuild and start containers
docker-compose up -d --build
```
