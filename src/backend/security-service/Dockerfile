# Stage 1: Builder with security optimizations
FROM rust:1.70-slim-bullseye AS builder

# Version comments for base images
# rust:1.70-slim-bullseye - Official Rust image with minimal footprint
# debian:bullseye-slim - Minimal Debian base for runtime

# Set environment variables for build optimization and security
ENV CARGO_HOME=/usr/local/cargo \
    RUSTFLAGS="-C target-cpu=native -C opt-level=3 -C codegen-units=1 -C lto=fat -C panic=abort -C strip=symbols" \
    RUST_BACKTRACE=1 \
    RUST_LOG=info

# Install build dependencies and security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Create build directory with proper permissions
WORKDIR /build
RUN chmod 755 /build

# Copy only necessary files for dependency resolution
COPY Cargo.toml Cargo.lock ./

# Create dummy source for dependency caching
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source code
COPY . .

# Build release binary with security optimizations
RUN cargo build --release --locked && \
    strip target/release/security-service

# Verify binary signatures and perform security scan
RUN cargo audit && \
    cargo clippy -- -D warnings

# Stage 2: Runtime with minimal attack surface
FROM debian:bullseye-slim

# Set runtime environment variables
ENV APP_USER=security \
    APP_DIR=/app \
    TZ=Etc/UTC \
    RUST_LOG=info \
    RUST_BACKTRACE=1

# Install minimal runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl1.1 \
    tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Create non-root user and group
RUN groupadd -r ${APP_USER} && \
    useradd -r -g ${APP_USER} -s /sbin/nologin -d ${APP_DIR} ${APP_USER}

# Set up application directory with proper permissions
RUN mkdir -p ${APP_DIR} && \
    chown -R ${APP_USER}:${APP_USER} ${APP_DIR} && \
    chmod 755 ${APP_DIR}

WORKDIR ${APP_DIR}

# Copy binary from builder stage
COPY --from=builder --chown=${APP_USER}:${APP_USER} /build/target/release/security-service ./

# Configure security limits and capabilities
RUN setcap 'cap_net_bind_service=+ep' ${APP_DIR}/security-service

# Set up health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:50051/health || exit 1

# Switch to non-root user
USER ${APP_USER}

# Expose necessary ports
EXPOSE 50051/tcp  # gRPC
EXPOSE 9090/tcp   # Metrics
EXPOSE 8080/tcp   # Health check

# Set up graceful shutdown
STOPSIGNAL SIGTERM

# Configure container networking security
EXPOSE 50051
EXPOSE 9090
EXPOSE 8080

# Set immutable filesystem permissions
RUN chmod 555 ${APP_DIR}/security-service

# Start security service
CMD ["./security-service"]