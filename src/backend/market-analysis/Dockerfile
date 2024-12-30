# Stage 1: Builder stage
FROM python:3.11-slim AS builder

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TF_ENABLE_ONEDNN_OPTS=1 \
    TF_GPU_ALLOCATOR=cuda_malloc_async

# Install system dependencies including CUDA support
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    nvidia-cuda-toolkit \
    && rm -rf /var/lib/apt/lists/*

# Create app directory with proper permissions
WORKDIR /build
RUN useradd -m -r appuser && chown appuser:appuser /build

# Copy and install Python dependencies
COPY --chown=appuser:appuser requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY --chown=appuser:appuser src/ src/
COPY --chown=appuser:appuser shared/ shared/

# Compile Python bytecode
RUN python -m compileall src/

# Create ML model directory structure
RUN mkdir -p /build/models /build/checkpoints /build/data && \
    chown -R appuser:appuser /build/models /build/checkpoints /build/data

# Stage 2: Final production image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=50051 \
    HEALTH_CHECK_PORT=8080 \
    TF_ENABLE_ONEDNN_OPTS=1 \
    TF_GPU_ALLOCATOR=cuda_malloc_async

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    nvidia-cuda-toolkit-runtime \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -s /bin/false appuser

# Create app directory with proper permissions
WORKDIR /app
RUN chown appuser:appuser /app

# Copy built artifacts from builder stage
COPY --from=builder --chown=appuser:appuser /build /app

# Create necessary directories with proper permissions
RUN mkdir -p /app/data /app/logs && \
    chown -R appuser:appuser /app/data /app/logs

# Switch to non-root user
USER appuser

# Set up volume mounts
VOLUME ["/app/data", "/app/logs"]

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${HEALTH_CHECK_PORT}/health || exit 1

# Set resource constraints
ENV NVIDIA_VISIBLE_DEVICES=all \
    NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Expose ports
EXPOSE ${PORT} ${HEALTH_CHECK_PORT}

# Set entrypoint with proper signal handling
ENTRYPOINT ["python", "-m", "src.main"]