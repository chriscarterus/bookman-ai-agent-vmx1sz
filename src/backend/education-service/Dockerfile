# Build Stage
FROM python:3.11-slim AS builder

# Build arguments
ARG PYTHON_VERSION=3.11
ARG BUILD_DATE
ARG VCS_REF

# Labels for container metadata
LABEL maintainer="Bookman AI Team <team@bookman.ai>" \
      version="1.0.0" \
      description="AI-powered education service for cryptocurrency learning" \
      org.label-schema.build-date=${BUILD_DATE} \
      org.label-schema.vcs-ref=${VCS_REF} \
      org.label-schema.schema-version="1.0"

# Install system dependencies and security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir safety bandit

# Set working directory
WORKDIR /build

# Copy requirements file
COPY requirements.txt .

# Security scan dependencies
RUN safety check -r requirements.txt \
    && pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Run security scan on source code
RUN bandit -r src/ -ll

# Runtime Stage
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

# Install Python and runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 10001 bookman && \
    useradd -u 10001 -g bookman -s /sbin/nologin -M bookman

# Set working directory
WORKDIR /app

# Copy installed packages and source from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /build/src ./src
COPY --from=builder /build/security ./security

# Set environment variables
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    ML_MODEL_PATH=/app/models \
    CUDA_VISIBLE_DEVICES=0 \
    MAX_WORKERS=4 \
    GUNICORN_WORKERS=4 \
    GUNICORN_THREADS=2 \
    LOG_LEVEL=INFO \
    SECURITY_SCAN_INTERVAL=3600

# Create necessary directories with proper permissions
RUN mkdir -p /app/models /var/log/security \
    && chown -R bookman:bookman /app /var/log/security \
    && chmod -R 755 /app \
    && chmod -R 744 /var/log/security

# Switch to non-root user
USER bookman

# Volume configuration
VOLUME ["/app/models", "/var/log/security"]

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Start command with security context
CMD ["python3", "-m", "uvicorn", "src.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--log-level", "info"]

# Security options
SECURITY_OPT ["no-new-privileges=true", "seccomp=unconfined"]