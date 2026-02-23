FROM node:20-slim AS base

LABEL org.opencontainers.image.title="HivePlay"
LABEL org.opencontainers.image.description="YouTube Music Streaming Platform with Snapcast multi-room casting"

# Install system dependencies: Python (for yt-dlp), FFmpeg (audio processing), curl (health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-full \
    python3-venv \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp in a virtual environment (avoids PEP 668 restrictions)
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir yt-dlp

# Verify yt-dlp + ffmpeg work
RUN yt-dlp --version && ffmpeg -version | head -1

WORKDIR /app

# ── Install Node.js dependencies ──
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Build the Next.js application ──
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install cheerio (needed for some scraping routes)
RUN npm install cheerio

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_SKIP_ESLINT=1
RUN npm run build

# ── Production runner ──
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Signal to app code that we're inside a container (used by ytdlp-locator to skip browser cookies)
ENV DOCKER=1

# Default configuration (override via docker-compose or .env)
ENV REDIS_URL=redis://redis:6379
# Snapcast casting (optional — leave empty to disable)
ENV SNAPCAST_HOST=""
ENV SNAPCAST_TCP_PORT=4953
ENV SNAPCAST_PORT=1705

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/.next && \
    chown -R nextjs:nodejs /app

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy yt-dlp update script
COPY --chown=nextjs:nodejs docker-update-ytdlp.sh ./docker-update-ytdlp.sh
RUN chmod +x ./docker-update-ytdlp.sh

# Make yt-dlp virtual environment available
COPY --from=base /opt/venv /opt/venv
# Allow the non-root nextjs user to upgrade yt-dlp at runtime
RUN chown -R nextjs:nodejs /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

USER nextjs
EXPOSE 3000

CMD ["npm", "start"]
