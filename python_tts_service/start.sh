#!/bin/bash
cd "$(dirname "$0")"

# 检查是否安装了 python3
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 could not be found."
    exit 1
fi

# 创建虚拟环境
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "Installing dependencies..."
    ./venv/bin/pip install -r requirements.txt
fi

# 检查 .env 文件是否存在，如果存在则加载
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# 检查 OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Warning: OPENAI_API_KEY is not set."
    echo "Please set it via 'export OPENAI_API_KEY=your_key' or in a .env file."
fi

echo "Starting TTS Service..."
./venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port 8000
