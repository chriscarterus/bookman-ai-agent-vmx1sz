# Build stage
FROM golang:1.21-alpine AS builder

# Version: v1.21.0
# Add build dependencies
RUN apk add --no-cache git ca-certificates build-base

# Install grpc_health_probe for health checks
RUN GRPC_HEALTH_PROBE_VERSION=v0.4.19 && \
    wget -qO/bin/grpc_health_probe https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc_health_probe-linux-amd64 && \
    chmod +x /bin/grpc_health_probe

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && \
    go mod verify

# Copy source code
COPY . .

# Build the application with security flags
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -trimpath -ldflags="-w -s \
    -X main.version=${SERVICE_VERSION} \
    -extldflags '-static'" \
    -o portfolio-service ./cmd/main.go

# Run security scan
RUN apk add --no-cache trivy && \
    trivy filesystem --exit-code 1 --severity HIGH,CRITICAL --no-progress /app/portfolio-service

# Final stage
FROM alpine:3.18

# Add runtime dependencies
RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 10001 -S nonroot && \
    adduser -u 10001 -S nonroot -G nonroot

# Copy binary and health probe from builder
COPY --from=builder /app/portfolio-service /usr/local/bin/
COPY --from=builder /bin/grpc_health_probe /usr/local/bin/

# Set permissions
RUN chmod +x /usr/local/bin/portfolio-service && \
    chmod +x /usr/local/bin/grpc_health_probe && \
    chown -R nonroot:nonroot /usr/local/bin/portfolio-service

# Configure container
WORKDIR /usr/local/bin
USER nonroot

# Add metadata labels
LABEL maintainer="Bookman AI Team" \
      service="portfolio-service" \
      version="${SERVICE_VERSION}"

# Expose ports
EXPOSE 50051/tcp
EXPOSE 9090/tcp

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["/usr/local/bin/grpc_health_probe", "-addr=:50051"]

# Set environment variables
ENV PORT=50051 \
    METRICS_PORT=9090 \
    TZ=UTC

# Create volume for temporary data
VOLUME ["/tmp"]

# Set security options
STOPSIGNAL SIGTERM

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/portfolio-service"]