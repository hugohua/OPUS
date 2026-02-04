#!/bin/bash

# Opus Offline Image Loader
# Usage: ./load-images.sh [DIR]
# Example: ./load-images.sh dockers

INPUT_DIR="${1:-dockers}"

# Check if directory exists
if [ ! -d "$INPUT_DIR" ]; then
    echo "Error: Directory '$INPUT_DIR' not found."
    exit 1
fi

echo "🚀 Loading Docker images from '$INPUT_DIR'..."

for tar_file in "$INPUT_DIR"/*.tar; do
    if [ -f "$tar_file" ]; then
        echo "Loading $tar_file ..."
        docker load -i "$tar_file"
    fi
done

echo "✅ All images loaded successfully."
docker images | grep opus
