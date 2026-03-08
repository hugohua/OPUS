"""
Edge-TTS 离线批量语音生成脚本 (Batch Edge-TTS Generator)
========================================================

功能:
    利用微软免费 Edge-TTS 引擎离线批量生成英语发音音频。
    生成的 .wav 文件通过 MD5 Hash 命名，与前端 lib/tts/hash.ts 完全一致，
    实现无缝缓存命中。同时自动 UPSERT 写入 PostgreSQL TTSCache 表。

依赖安装:
    cd python_tts_service
    source venv/bin/activate
    pip install edge-tts tenacity psycopg2-binary python-dotenv

使用方法:
    # 1. 单条文本测试
    python batch_edge_tts.py --text "Hello world" --lang "en-US"

    # 2. 从 JSON 文件批量生成 (推荐配合 export-tts-targets.ts 使用)
    python batch_edge_tts.py --file "../output/tts_targets.json" --lang "en-US" --concurrency 3

    # 3. 从 CSV 文件批量生成
    python batch_edge_tts.py --file "data.csv" --col "sentence" --lang "en-US"

    # 4. 从纯文本文件批量生成 (每行一条)
    python batch_edge_tts.py --file "texts.txt" --lang "en-US"

参数:
    --text          单条文本
    --file          批量输入文件 (JSON/CSV/TXT)
    --col           JSON/CSV 中文本字段名 (默认: text)
    --voice         Opus 声音标识 (默认: Cherry)
    --lang          语言 (默认: en-US)
    --speed         语速 (默认: 1.0)
    --output        音频输出目录 (默认: ../public/audio)
    --concurrency   并发数 (默认: 3, 建议不超过 5)

断点续传:
    脚本支持天然断点续传。中断后重跑同一命令，会自动跳过已存在的 .wav 文件。

日志:
    输出到控制台 + logs/edge_tts_batch_时间戳.log

相关文档:
    docs/dev-notes/edge-tts-offline-generation.md
"""

import asyncio
import hashlib
import os
import sys
import argparse
import json
import csv
import psycopg2
from datetime import datetime
from urllib.parse import urlparse

try:
    import edge_tts
except ImportError:
    sys.exit("当前环境缺少 edge-tts 依赖。请运行: pip install edge-tts")

try:
    from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type, before_sleep_log
    import logging
except ImportError:
    sys.exit("当前环境缺少 tenacity 依赖用于重试。请运行: pip install tenacity")

try:
    from dotenv import load_dotenv
except ImportError:
    sys.exit("当前环境缺少 python-dotenv 依赖。请运行: pip install python-dotenv")

# --- Logger Setup ---
log_dir = os.path.join(os.path.dirname(__file__), '..', 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, f'edge_tts_batch_{datetime.now().strftime("%Y%md_%H%M%S")}.log')

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(log_file, encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# --- Load Env ---
# 自动向上寻找 .env 文件
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
load_dotenv(dotenv_path=env_path)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    logger.warning("未找到 DATABASE_URL 环境变量，生成的音频将不会写入数据库。")

# Voice Mapping from Aliyun DashScope (e.g. Cherry) + Language to Edge-TTS voice
EDGE_VOICE_MAP = {
    "en-US": "en-US-AriaNeural",      # 英文女声
    "zh-CN": "zh-CN-XiaoxiaoNeural",  # 中文女声
    "en-GB": "en-GB-SoniaNeural",     # 英音女声（如果有的话）
    "en-UK": "en-GB-SoniaNeural"      # 兼容有时传入的 en-UK
}

def sanitize_for_tts(text: str) -> str:
    """
    清洗文本中的格式标记，确保 Hash 输入是纯净的自然语言。
    ⚠️ CRITICAL: 必须与前端 lib/tts/hash.ts 的 sanitizeForTTS() 完全一致
    
    处理内容:
    1. Markdown 加粗: **word** → word
    2. Markdown 斜体: *word* 或 _word_ → word
    3. Markdown 链接: [text](url) → text
    4. XML/HTML 标签: <chunk>, <s>, <v>, <o>, <emotional_tone="..."> 等 → 移除
    5. 多余空白: 压缩为单空格
    """
    import re
    result = text
    result = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', result) # Strip markdown links, keep text
    result = re.sub(r'(\*\*|__)(.*?)\1', r'\2', result)      # Strip bold (** or __)
    result = re.sub(r'(\*|_)(.*?)\1', r'\2', result)         # Strip italic (* or _)
    result = re.sub(r'<[^>]*>', '', result)                  # Strip XML/HTML tags
    result = re.sub(r'\s+', ' ', result).strip()             # Collapse whitespace
    return result

def generate_audio_hash(text: str, voice: str = "Cherry", language: str = "en-US", speed: float = 1.0) -> str:
    """
    生成音频缓存 Hash
    ⚠️ CRITICAL: 必须与前端 lib/tts/hash.ts 以及 python_tts_service/core/hash.py 的算法一致
    [V6.2] 在 Hash 前统一清洗 Markdown/XML 标记
    """
    cleaned_text = sanitize_for_tts(text)
    speed_str = f"{speed:.1f}"
    hash_input = f"{cleaned_text}_{voice}_{language}_{speed_str}"
    return hashlib.md5(hash_input.encode('utf-8')).hexdigest()

def normalize_speed(speed: float) -> str:
    """将 speed 转为 edge-tts 认识的速率。例如 1.0 -> +0%, 1.2 -> +20%, 0.8 -> -20%"""
    diff_percent = int((speed - 1.0) * 100)
    if diff_percent >= 0:
        return f"+{diff_percent}%"
    else:
        return f"{diff_percent}%"

def get_db_connection():
    if not DATABASE_URL:
        return None
    try:
        # 解析 url 为 psycopg2 能识别的格式
        result = urlparse(DATABASE_URL)
        username = result.username
        password = result.password
        database = result.path[1:]
        hostname = result.hostname
        port = result.port
        # 注意: 内部工具如果是 localhost 可能不需要全部参数
        conn = psycopg2.connect(
            database=database,
            user=username,
            password=password,
            host=hostname,
            port=port
        )
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to DB: {e}")
        return None

def upsert_tts_cache(conn, hash_val: str, text: str, voice: str, language: str, speed: float, file_path: str, file_size: int, source: str = "edge-tts"):
    """使用 Postgres ON CONFLICT DO UPDATE 实现 Upsert"""
    if not conn:
        return
    
    relative_path = f"audio/{os.path.basename(file_path)}"
    # 因为挂载点通常在 /public/audio 下面
    url = f"/{relative_path}"
    
    query = """
        INSERT INTO "TTSCache" (
            "id", "text", "voice", "language", "speed", 
            "cacheType", "filePath", "url", "fileSize", 
            "createdAt", "lastUsedAt", "source"
        )
        VALUES (
            %s, %s, %s, %s, %s, 
            'temporary', %s, %s, %s, 
            %s, %s, %s
        )
        ON CONFLICT ("id") DO UPDATE SET
            "text" = EXCLUDED."text",
            "fileSize" = EXCLUDED."fileSize",
            "lastUsedAt" = EXCLUDED."lastUsedAt",
            "source" = EXCLUDED."source"
    """
    now = datetime.now()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (
                hash_val, text, voice, language, speed,
                relative_path, url, file_size,
                now, now, source
            ))
        conn.commit()
        logger.debug(f"[DB Sync] {hash_val} inserted/updated in TTSCache.")
    except Exception as e:
        conn.rollback()
        logger.error(f"[DB Error] Sync failed for {hash_val}: {e}")

# 指数退避重试装饰器 (Network Resiliency Warning 修复)
# 最大重试 4 次，延迟 2, 4, 8, 16 秒
@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=2, min=2, max=16),
    before_sleep=before_sleep_log(logger, logging.WARNING)
)
async def process_single_tts(text: str, voice: str, language: str, speed: float, output_dir: str, db_conn):
    """处理单个 TTS 音频生成，带有基于 tenacity 的防封存保护与 DB 写入"""
    speed_str = f"{speed:.1f}"
    cleaned_text = sanitize_for_tts(text) # [Audit Fix]: 统一清洗
    hash_val = generate_audio_hash(text, voice, language, speed) # generate_audio_hash 会再次独立清洗计算 Hash
    file_path = os.path.join(output_dir, f"{hash_val}.wav")
    
    # 检查缓存是否存在且体量合理（>0 bytes）
    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        logger.info(f"[CACHE HIT] {hash_val}.wav | {cleaned_text[:20]}...")
        # 防护性同步一次数据库，防止前台没有这条记录
        # [Audit Fix]: 必须写入 cleaned_text，保证 DB 面貌干净
        upsert_tts_cache(db_conn, hash_val, cleaned_text, voice, language, speed, file_path, os.path.getsize(file_path))
        return True
    
    # 确定实际调用的 Edge TTS Voice
    edge_voice = EDGE_VOICE_MAP.get(language, "en-US-AriaNeural")
    rate_str = normalize_speed(speed)
    
    try:
        # [Audit Fix]: 主动限流防封禁防沉迷，每生成一个间隔 0.5s 
        await asyncio.sleep(0.5)
        
        # 尝试生成
        communicate = edge_tts.Communicate(cleaned_text, edge_voice, rate=rate_str)
        await communicate.save(file_path)
        file_size = os.path.getsize(file_path)
        logger.info(f"[SUCCESS] {hash_val}.wav | {edge_voice} | size={file_size} | {cleaned_text[:20]}...")
        
        # 成功后写入数据库 
        # [Audit Fix]: 写入 cleaned_text 保证数据库中永远只有纯自然语言
        upsert_tts_cache(db_conn, hash_val, cleaned_text, voice, language, speed, file_path, file_size)
            
        return True
    except Exception as e:
        logger.error(f"[ERROR] generating {hash_val} | Error: {str(e)}")
        # 如果是因为网络封禁（抛出异常），tenacity 会捕获并执行指数退避重试
        raise e

async def batch_generate_tts(texts: list, voice: str, language: str, speed: float, output_dir: str, concurrency_limit: int = 3):
    """基于列表批量生成"""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    semaphore = asyncio.Semaphore(concurrency_limit)
    db_conn = get_db_connection()
    if db_conn:
        logger.info("✅ Database connected. Will sync to TTSCache.")
    
    async def bounded_generate(text):
        async with semaphore:
            try:
                success = await process_single_tts(text, voice, language, speed, output_dir, db_conn)
                if success:
                    # 全局保护：即使成功也强制留出最小呼吸时间，避免微软立即 Rate limit
                    await asyncio.sleep(0.5)
            except Exception as e:
                logger.error(f"❌ Final abortion off text snippet due to max retries exceeded: {text[:20]}...")

    tasks = [bounded_generate(t) for t in texts]
    await asyncio.gather(*tasks)
    
    if db_conn:
        db_conn.close()
    
    logger.info(f"\n🎉 Batch process completed. Processed ~{len(texts)} texts.")

def parse_input_file(filepath: str, text_col: str) -> list:
    """从 csv/json 文件中提取文本列表"""
    texts = []
    if filepath.endswith('.json'):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, list):
                for item in data:
                    if text_col in item:
                        texts.append(item[text_col])
    elif filepath.endswith('.csv'):
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            if text_col in reader.fieldnames:
                for row in reader:
                    if row[text_col].strip():
                        texts.append(row[text_col].strip())
    else:
        # 当做普通按行分割的文本文件处理
        with open(filepath, 'r', encoding='utf-8') as f:
            texts = [line.strip() for line in f if line.strip()]
    return texts

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Opus Offline Edge-TTS Batch Generator (with DB Write)")
    parser.add_argument("--text", type=str, help="单个文本生成调用。如果设置了 --text，将忽略 --file。")
    parser.add_argument("--file", type=str, help="批量文件路径 (JSON, CSV 或 TXT)。")
    parser.add_argument("--col", type=str, default="text", help="JSON 或 CSV 文件中的文本字段名称 (默认为 'text')。")
    parser.add_argument("--voice", type=str, default="Cherry", help="保留 Opus 原始 Voice 名称（用于 Hash），默认为 Cherry。")
    parser.add_argument("--lang", type=str, default="en-US", help="语言类型 (en-US, zh-CN 等)。")
    parser.add_argument("--speed", type=float, default=1.0, help="语速 (与线上一致，默认为 1.0)。")
    parser.add_argument("--output", type=str, default="../public/audio", help="音频缓存输出目录。")
    parser.add_argument("--concurrency", type=int, default=3, help="并发数量。建议不要太大以防微软封IP。")

    args = parser.parse_args()

    texts_to_process = []
    
    if args.text:
        texts_to_process.append(args.text)
    elif args.file:
        if not os.path.exists(args.file):
            sys.exit(f"File not found: {args.file}")
        texts_to_process = parse_input_file(args.file, args.col)
    else:
        parser.print_help()
        sys.exit("\n⚠️ Please provide either --text or --file argument.")

    if not texts_to_process:
        sys.exit("No texts found to process.")
        
    logger.info(f"🚀 Starting batch generation for {len(texts_to_process)} texts. Logs will be saved to: {log_file}")

    asyncio.run(batch_generate_tts(
        texts=texts_to_process,
        voice=args.voice,
        language=args.lang,
        speed=args.speed,
        output_dir=args.output,
        concurrency_limit=args.concurrency
    ))
