#!/bin/bash

# Build script specifically for ARM-based devices like Khadas

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "===== Building HivePlay for ARM devices (like Khadas) ====="
echo "This may take some time..."

# Pull the ARM-compatible base images
docker pull --platform linux/arm64 node:20-slim
docker pull --platform linux/arm64 redis:alpine

# Build the Docker images
docker-compose build --no-cache

echo "===== Build complete! ====="
echo "To start the application, run: docker-compose up -d"
echo "The application will be available at http://localhost:3000"
