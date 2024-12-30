# Stage 1: Dependencies
FROM node:18-alpine AS dependencies
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files and dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./

# Copy source code and configs
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN npm install typescript
RUN npm run build

# Stage 3: Production
FROM node:18-alpine AS production
WORKDIR /app

# Create non-root user
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Install production dependencies
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Set ownership and permissions
RUN chown -R nodejs:nodejs /app && \
    chmod -R 755 /app

# Set runtime configurations
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Expose ports for HTTP and gRPC
EXPOSE 3000 50051

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Set Node.js runtime flags for containers
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384 --no-deprecation"

# Start the service
CMD ["node", "dist/index.js"]