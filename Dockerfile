FROM node:20-slim AS base

# Display HIVEPLAY banner
RUN echo '╔══════════════════════════════════════════════════════════════════════════════╗' && \
    echo '║                                                                              ║' && \
    echo '║  ██╗  ██╗██╗██╗   ██╗███████╗██████╗ ██╗      █████╗ ██╗   ██╗             ║' && \
    echo '║  ██║  ██║██║██║   ██║██╔════╝██╔══██╗██║     ██╔══██╗╚██╗ ██╔╝             ║' && \
    echo '║  ███████║██║██║   ██║█████╗  ██████╔╝██║     ███████║ ╚████╔╝              ║' && \
    echo '║  ██╔══██║██║╚██╗ ██╔╝██╔══╝  ██╔═══╝ ██║     ██╔══██║  ╚██╔╝               ║' && \
    echo '║  ██║  ██║██║ ╚████╔╝ ███████╗██║     ███████╗██║  ██║   ██║                ║' && \
    echo '║  ╚═╝  ╚═╝╚═╝  ╚═══╝  ╚══════╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝                ║' && \
    echo '║                                                                              ║' && \
    echo '║              🎵 YouTube Music Streaming Platform 🎵                         ║' && \
    echo '║                   🚀 Building with Docker 🚀                                ║' && \
    echo '║                                                                              ║' && \
    echo '╚══════════════════════════════════════════════════════════════════════════════╝' && \
    echo '' && \
    echo '🔧 Installing system dependencies...'

# Set application name label
LABEL org.opencontainers.image.title="HivePlay"
LABEL org.opencontainers.image.description="YouTube player with Redis cache and yt-dlp integration"

# Install dependencies for yt-dlp
RUN echo '🎶 Installing Python, FFmpeg, and media tools...' && \
    apt-get update && apt-get install -y \
    python3 \
    python3-full \
    python3-venv \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/* && \
    echo '✅ System dependencies installed successfully!'

# Install yt-dlp using a virtual environment to avoid PEP 668 restrictions
RUN echo '📦 Setting up Python virtual environment...' && \
    python3 -m venv /opt/venv && \
    echo '✅ Virtual environment created!'
ENV PATH="/opt/venv/bin:$PATH"
RUN echo '⬇️  Installing yt-dlp (YouTube downloader)...' && \
    pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir yt-dlp && \
    echo '✅ yt-dlp installed successfully!'

# Check if yt-dlp is installed correctly
RUN echo '🔍 Verifying yt-dlp installation...' && \
    yt-dlp --version && \
    echo '✅ yt-dlp verification successful!'

# Set working directory
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
RUN echo '📦 Installing Node.js dependencies...'
COPY package.json package-lock.json* ./
RUN npm ci && \
    echo '✅ Node.js dependencies installed!'

# Building the application
FROM base AS builder
WORKDIR /app
RUN echo '🔨 Building HivePlay application...'
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Explicitly install cheerio
RUN echo '📚 Installing additional packages...' && \
    npm install cheerio && \
    echo '✅ Additional packages installed!'

# Build the application - skip linting and type checking
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_SKIP_ESLINT=1
RUN echo '⚡ Compiling Next.js application...' && \
    npm run build && \
    echo '✅ Build completed successfully!'

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
RUN echo '🚀 Setting up production environment...'

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN echo '👤 Creating application user...' && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir -p /app/.next && \
    chown -R nextjs:nodejs /app && \
    echo '✅ User setup completed!'

# Copy built application
RUN echo '📁 Copying application files...'
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

RUN echo '✅ Application files copied successfully!'

# Switch to non-root user
USER nextjs

# Expose the port
EXPOSE 3000

# Set the environment variables for Redis
ENV REDIS_URL=redis://redis:6379

# Final setup message
RUN echo '' && \
    echo '╔══════════════════════════════════════════════════════════════════════════════╗' && \
    echo '║                                                                              ║' && \
    echo '║                        🎉 HIVEPLAY BUILD COMPLETE! 🎉                       ║' && \
    echo '║                                                                              ║' && \
    echo '║  ✅ Node.js environment ready                                                 ║' && \
    echo '║  ✅ yt-dlp installed and configured                                          ║' && \
    echo '║  ✅ FFmpeg ready for audio processing                                        ║' && \
    echo '║  ✅ Application built and optimized                                          ║' && \
    echo '║  ✅ Security configured (non-root user)                                      ║' && \
    echo '║                                                                              ║' && \
    echo '║              🚀 Ready to serve on port 3000! 🚀                             ║' && \
    echo '║                                                                              ║' && \
    echo '╚══════════════════════════════════════════════════════════════════════════════╝' && \
    echo ''

CMD ["npm", "start"]
