#!/bin/bash
# 启动本地 Python TTS 服务

# 1. 设置工作目录
cd "$(dirname "$0")/.."

# 2. 检查 venv 是否存在
if [ ! -d "tts_venv" ]; then
    echo "❌ 虚拟环境 tts_venv 不存在。请先运行:"
    echo "   /usr/bin/python3 -m venv tts_venv"
    echo "   source tts_venv/bin/activate && pip install -r python_tts_service/requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple"
    exit 1
fi

# 3. 创建音频目录
mkdir -p public/audio

# 4. 配置环境变量
export OPENAI_API_KEY=sk-27bc50f0b4f646b98e3862c81a49101e
export OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

echo "🚀 正在启动 Opus TTS 服务..."
echo "📍 API 文档: http://localhost:8000/docs"
echo "📂 音频缓存: ./public/audio"

# 5. 启动服务 (使用 venv 中的 uvicorn)
echo "📂 切换工作目录到 python_tts_service..."
cd python_tts_service

# 设置 PYTHONPATH 为当前目录
export PYTHONPATH=$(pwd)
export OPENAI_API_KEY=sk-27bc50f0b4f646b98e3862c81a49101e

../tts_venv/bin/python3 -m uvicorn main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --reload \
    --workers 1
