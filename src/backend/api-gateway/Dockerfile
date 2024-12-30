# Use Kong Enterprise as base image
FROM kong:3.0-alpine
# Version: 3.0-alpine

# Set maintainer label
LABEL maintainer="Bookman AI Platform Team"
LABEL description="Kong API Gateway for Bookman AI Platform"
LABEL version="1.0.0"

# Install additional security packages
RUN apk add --no-cache \
    curl \
    openssl \
    tzdata \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create necessary directories with proper permissions
RUN mkdir -p /usr/local/kong/declarative \
    && mkdir -p /etc/kong/certificates \
    && mkdir -p /usr/local/kong/logs \
    && mkdir -p /tmp/kong_prometheus_metrics \
    && chown -R kong:kong /usr/local/kong \
    && chown -R kong:kong /etc/kong \
    && chown -R kong:kong /tmp/kong_prometheus_metrics

# Copy configuration files
COPY --chown=kong:kong kong.yml /usr/local/kong/declarative/kong.yml
COPY --chown=kong:kong plugins.yml /usr/local/kong/declarative/plugins.yml
COPY --chown=kong:kong routes.yml /usr/local/kong/declarative/routes.yml

# Copy SSL certificates
COPY --chown=kong:kong certificates/*.crt /etc/kong/certificates/
COPY --chown=kong:kong certificates/*.key /etc/kong/certificates/

# Set proper permissions for sensitive files
RUN chmod 644 /etc/kong/certificates/*.crt \
    && chmod 600 /etc/kong/certificates/*.key

# Configure Kong environment variables
ENV KONG_DATABASE=off \
    KONG_DECLARATIVE_CONFIG=/usr/local/kong/declarative/kong.yml \
    KONG_SSL_CERT=/etc/kong/certificates/server.crt \
    KONG_SSL_CERT_KEY=/etc/kong/certificates/server.key \
    KONG_PROXY_ACCESS_LOG=/dev/stdout \
    KONG_ADMIN_ACCESS_LOG=/dev/stdout \
    KONG_PROXY_ERROR_LOG=/dev/stderr \
    KONG_ADMIN_ERROR_LOG=/dev/stderr \
    KONG_PROXY_LISTEN="0.0.0.0:8000 ssl http2, 0.0.0.0:8443 ssl http2" \
    KONG_ADMIN_LISTEN="0.0.0.0:8001 ssl, 0.0.0.0:8444 ssl" \
    KONG_PLUGINS="bundled,prometheus,jwt,rate-limiting,cors,oauth2" \
    KONG_NGINX_WORKER_PROCESSES=auto \
    KONG_NGINX_WORKER_CONNECTIONS=2048 \
    KONG_PROXY_STREAM=on \
    KONG_TRACING=on \
    KONG_TRACING_SAMPLING=100

# Security hardening
RUN adduser -S -D -H -h /usr/local/kong kong \
    && chown -R kong:kong /usr/local/kong \
    && chmod -R g=u /usr/local/kong

# Set resource limits
ENV KONG_NGINX_WORKER_RLIMIT_NOFILE=65535 \
    KONG_NGINX_WORKER_CONNECTIONS=16384 \
    KONG_MEM_CACHE_SIZE=256m

# Configure healthcheck
HEALTHCHECK --interval=10s --timeout=10s --retries=3 --start-period=30s \
    CMD kong health

# Expose ports
# 8000: Proxy SSL
# 8443: Proxy SSL (Alternative)
# 8001: Admin API SSL
# 8444: Admin API SSL (Alternative)
EXPOSE 8000 8443 8001 8444

# Set user
USER kong

# Define volumes
VOLUME ["/usr/local/kong/declarative", "/etc/kong/certificates", "/usr/local/kong/logs", "/tmp/kong_prometheus_metrics"]

# Start Kong
CMD ["kong", "docker-start"]