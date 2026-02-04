#!/bin/bash

# Opus Docker Build & Export Script
# Usage: ./scripts/build-and-export.sh [TAG]
# Example: ./scripts/build-and-export.sh v1.0.0

set -e

# Configuration
VERSION="${1:-latest}"
OUTPUT_DIR="dockers"
WEB_IMAGE="opus-web:${VERSION}"
TTS_IMAGE="opus-tts:${VERSION}"
WORKER_IMAGE="opus-worker:${VERSION}"
DB_IMAGE="ankane/pgvector:latest"
REDIS_IMAGE="redis:7-alpine"
GATEWAY_IMAGE="nginx:alpine"

# Formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Proxy Configuration (copied from reference)
PROXY_HOST="http://127.0.0.1:1087"
NO_PROXY_VALUE="localhost,127.0.0.1,*.internal,192.168.0.0/16,10.*.*.*"

# Save old proxy settings
OLD_HTTP_PROXY="${http_proxy:-}"
OLD_HTTPS_PROXY="${https_proxy:-}"
OLD_NO_PROXY="${no_proxy:-}"

restore_proxy() {
    export http_proxy="$OLD_HTTP_PROXY"
    export https_proxy="$OLD_HTTPS_PROXY"
    export no_proxy="$OLD_NO_PROXY"
}

setup_proxy() {
    export http_proxy="$PROXY_HOST"
    export https_proxy="$PROXY_HOST"
    export no_proxy="$NO_PROXY_VALUE"
}

trap restore_proxy EXIT

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# 1. Prepare Output Directory
setup_proxy
print_info "Using Proxy: $PROXY_HOST"

if [ ! -d "$OUTPUT_DIR" ]; then
    print_info "Creating output directory: $OUTPUT_DIR"
    mkdir -p "$OUTPUT_DIR"
fi

# 2. Build Images
print_info "Building Opus Web (${WEB_IMAGE})..."
DOCKER_BUILDKIT=1 docker build --progress=plain -t "$WEB_IMAGE" -f Dockerfile .

print_info "Building Opus Worker (${WORKER_IMAGE})..."
DOCKER_BUILDKIT=1 docker build --progress=plain -t "$WORKER_IMAGE" -f Dockerfile.worker .

print_info "Building Opus TTS (${TTS_IMAGE})..."
DOCKER_BUILDKIT=1 docker build --progress=plain -t "$TTS_IMAGE" -f python_tts_service/Dockerfile python_tts_service

# 3. Pull External Images (to ensure we export the latest)
print_info "Pulling external services..."
docker pull $DB_IMAGE
docker pull $REDIS_IMAGE
docker pull $GATEWAY_IMAGE

# 4. Save Images
save_image() {
    local IMAGE=$1
    local FILENAME=$(echo $IMAGE | tr '/:' '-').tar
    local FILEPATH="${OUTPUT_DIR}/${FILENAME}"
    
    print_info "Exporting $IMAGE to $FILEPATH ..."
    docker save "$IMAGE" -o "$FILEPATH"
}

save_image "$WEB_IMAGE"
save_image "$WORKER_IMAGE"
save_image "$TTS_IMAGE"
save_image "$DB_IMAGE"
save_image "$REDIS_IMAGE"
save_image "$GATEWAY_IMAGE"

print_info "✅ All images exported to ${OUTPUT_DIR}/"
ls -lh "$OUTPUT_DIR"
