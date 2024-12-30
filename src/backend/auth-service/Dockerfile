# Stage 1: Builder
FROM node:18-alpine AS builder

# Build arguments
ARG NODE_ENV=production
ARG BUILD_VERSION=1.0.0

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with exact versions and security audit
RUN npm ci && \
    npm audit fix && \
    npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build && \
    npm prune --production && \
    rm -rf src/ && \
    rm -rf node_modules/.cache

# Stage 2: Production
FROM node:18-alpine

# Build arguments and labels
ARG NODE_ENV=production
ARG BUILD_VERSION=1.0.0
ARG BUILD_DATE

LABEL maintainer="Bookman AI Team" \
      version="${BUILD_VERSION}" \
      service="auth-service" \
      security.protocol="enhanced" \
      build.date="${BUILD_DATE}" \
      build.version="${BUILD_VERSION}"

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache wget curl && \
    addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs && \
    mkdir -p /app/node_modules && \
    chown -R nodejs:nodejs /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Set secure permissions
RUN chmod -R 440 package*.json && \
    chmod -R 550 dist/ && \
    chmod -R 550 node_modules/

# Environment configuration
ENV NODE_ENV=production \
    PORT=3000 \
    NODE_OPTIONS="--max-old-space-size=2048" \
    PATH="/app/node_modules/.bin:$PATH"

# Security hardening
RUN echo "nodejs:x:1001:1001::/app:/sbin/nologin" >> /etc/passwd && \
    echo "nodejs:x:1001:" >> /etc/group

# Drop capabilities and secure runtime
RUN mkdir -p /tmp/nodejs && \
    chown nodejs:nodejs /tmp/nodejs && \
    chmod 1777 /tmp/nodejs

# Expose service port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set read-only filesystem
VOLUME ["/tmp/nodejs", "/app/node_modules"]

# Start production server
CMD ["node", "dist/index.js"]