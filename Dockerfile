FROM node:20-slim AS base

# Set application name label
LABEL org.opencontainers.image.title="HivePlay"
LABEL org.opencontainers.image.description="YouTube player with Redis cache and yt-dlp integration"

# Install dependencies for yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-full \
    python3-venv \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp using a virtual environment to avoid PEP 668 restrictions
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir yt-dlp

# Check if yt-dlp is installed correctly
RUN yt-dlp --version

# Set working directory
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# Building the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Explicitly install cheerio
RUN npm install cheerio

# Build the application - skip linting and type checking
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_SKIP_ESLINT=1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /app/.next
RUN chown -R nextjs:nodejs /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy the yt-dlp update script
COPY --chown=nextjs:nodejs docker-update-ytdlp.sh ./docker-update-ytdlp.sh
RUN chmod +x ./docker-update-ytdlp.sh

# Make sure the yt-dlp virtual environment is available in the final stage
COPY --from=base /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Switch to non-root user
USER nextjs

# Expose the port
EXPOSE 3000

# Set the environment variables for Redis
ENV REDIS_URL=redis://redis:6379

CMD ["npm", "start"]
