# syntax=docker/dockerfile:1
# Multi-stage Containerfile for Syncopated Context Compiler
# Optimized for Podman and Docker rootless environments

# -------------------------------------------------------------
# Stage 1: Build static frontend assets and resolve dependencies
# -------------------------------------------------------------
FROM docker.io/library/node:22-alpine AS builder

WORKDIR /app

# Install dependencies needed for build tools
COPY package.json package-lock.json ./
RUN npm ci

# Copy build configuration and application source
COPY tsconfig.json vite.config.ts index.html metadata.json components.json ./
COPY src ./src
COPY lib ./lib
COPY components ./components
COPY server.ts ./

# Build production Vite SPA
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Minimal production runtime
# -------------------------------------------------------------
FROM docker.io/library/node:22-alpine AS runner

LABEL org.opencontainers.image.title="syncopated-context-compiler" \
      org.opencontainers.image.description="Visual driver and context compiler for LLM conversation graphs" \
      org.opencontainers.image.authors="Robert Pannick <rwpannick@gmail.com>" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Default runtime environment
ENV NODE_ENV=production \
    PORT=3000

# Copy application configuration and dependencies
COPY --chown=node:node package.json tsconfig.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

# Copy backend files required at runtime by server.ts
COPY --from=builder --chown=node:node /app/server.ts ./server.ts
COPY --from=builder --chown=node:node /app/src ./src
COPY --from=builder --chown=node:node /app/lib ./lib
COPY --from=builder --chown=node:node /app/components ./components

# Unprivileged user for rootless Podman execution
USER node

# Expose default HTTP port
EXPOSE 3000

# Health check probing Express health endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Launch the server directly so PID 1 receives SIGTERM/SIGINT immediately
CMD ["node_modules/.bin/tsx", "server.ts"]
