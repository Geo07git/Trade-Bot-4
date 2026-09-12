# Multi-stage Dockerfile optimized for ARM64 (aarch64) and AMD64
# GS Trading Bot - Autonomous 24/7 Platform

FROM node:20-slim AS builder

WORKDIR /app

# Install build tools for native dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source code
COPY . .

# Build Vite frontend and bundled Node server (dist/server.cjs)
RUN npm run build

# -------------------------------------------------------------
# Production Runner Stage (Minimal footprint)
# -------------------------------------------------------------
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy built assets and server bundle
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/ecosystem.config.cjs ./

# Install production-only dependencies
RUN npm ci --only=production && rm -rf /root/.npm

# Copy default state directories and config files if present
COPY --from=builder /app/bot_state.json ./bot_state.json
COPY --from=builder /app/server/data ./server/data

# Ensure data directory exists
RUN mkdir -p /app/server/data /app/data

EXPOSE 3000

# Start autonomous production server
CMD ["node", "dist/server.cjs"]
