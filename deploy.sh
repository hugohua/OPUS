#!/bin/bash

# Opus Production Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting Opus Production Deployment..."

# 1. 检查必要文件
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found."
    echo "👉 Please copy .env.example.production to .env.production and fill in your secrets."
    exit 1
fi

# 2. 拉取最新代码 (可选，如果是在服务器上直接运行)
# echo "📥 Pulling latest code..."
# git pull origin main

# 3. 构建并启动容器
echo "🏗️  Building and starting services..."
docker-compose -f docker-compose.prod.yml up -d --build --remove-orphans

# 4. 清理未使用镜像
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment completed successfully!"
echo "🌍 Gateway running on port 80"
