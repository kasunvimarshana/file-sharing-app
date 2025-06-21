# Multi-stage Dockerfile for P2P Distributed System
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# RUN npm ci --only=production && npm cache clean --force
RUN npm ci && npm cache clean --force

# Copy application code
COPY backend/ ./backend/
COPY src/ ./src/
COPY index.html ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY postcss.config.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S p2puser -u 1001

# Change ownership of app directory
RUN chown -R p2puser:nodejs /app
USER p2puser

# Expose ports
EXPOSE 8080 8000 3478 3479

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command (can be overridden)
CMD ["node", "backend/signaling-server.js"]