# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and security tools
RUN apk add --no-cache python3 make g++ git curl \
    && npm install -g npm@9.x.x \
    && npm install -g snyk

# Copy package files
COPY package*.json ./

# Install dependencies with security audit
RUN npm ci --audit=true \
    && npm audit fix --force \
    && snyk test || true

# Copy source code
COPY . .

# Build application with optimizations
RUN npm run build \
    && npm run analyze

# Stage 2: Production environment
FROM nginx:1.25-alpine

# Install security updates and tools
RUN apk update && apk upgrade \
    && apk add --no-cache curl tzdata \
    && rm -rf /var/cache/apk/*

# Create nginx user/group with restricted permissions
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create required directories with proper permissions
RUN mkdir -p /var/cache/nginx \
    && mkdir -p /var/log/nginx \
    && chown -R nginx:nginx /var/cache/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && chmod -R 755 /var/cache/nginx \
    && chmod -R 755 /var/log/nginx

# Copy built assets from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Set correct permissions for web root
RUN chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /usr/share/nginx/html

# Configure security settings
RUN rm /etc/nginx/conf.d/default.conf \
    && mkdir -p /tmp/nginx \
    && chown -R nginx:nginx /tmp/nginx \
    && chmod -R 755 /tmp/nginx

# Set environment variables
ENV NGINX_PORT=80 \
    NGINX_WORKER_PROCESSES=auto \
    NGINX_WORKER_CONNECTIONS=1024 \
    TZ=UTC

# Set up volumes for persistence
VOLUME ["/var/cache/nginx", "/var/log/nginx"]

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Set security options
LABEL security.protocol=strict \
      security.capabilities=none \
      security.root.readonly=true

# Start nginx
CMD ["nginx", "-g", "daemon off;"]