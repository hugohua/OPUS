"""
Opus TOEIC PDF OCR Pipeline (V3 - Parallel + Resume)
======================================================
每页独立文件 (books/ocr_pages/page_001.txt)，天然保证页码顺序。

使用方式:
  # 1. 全量提取 (默认4并发)
  python scripts/ocr_pdf_to_text.py

  # 2. 指定范围 + 并发数
  python scripts/ocr_pdf_to_text.py --start-page 66 --end-page 75 --workers 6

  # 3. 重试失败页
  python scripts/ocr_pdf_to_text.py --retry

  # 4. 合并所有页面到一个文件 (按页码顺序)
  python scripts/ocr_pdf_to_text.py --merge
"""

import fitz  # PyMuPDF
import openai
import os
import sys
import json
import argparse
import time
import base64
import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor

# ── Config ──
PAGES_DIR    = os.path.join('books', 'ocr_pages')
MERGED_FILE  = os.path.join('books', 'toeic_full_ocr.txt')
FAILED_LOG   = os.path.join('books', 'ocr_failed_pages.log')
PDF_PATH     = os.path.join('books', '新托业语法和词汇详解及实战试题part5-6（21套）.pdf')

MAX_RETRIES        = 3
BASE_RETRY_DELAY_S = 3
RATE_LIMIT_PAUSE_S = 30   # 429 时暂停秒数

# ── Env ──
def load_env():
    env_path = os.path.join(os.getcwd(), '.env')
    if not os.path.exists(env_path):
        print("❌ .env not found!"); sys.exit(1)
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'): continue
            if '=' in line:
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if '#' in value:
                    value = value.split('#')[0].strip().strip('"').strip("'")
                if key and value:
                    os.environ.setdefault(key, value)

# ── Per-page file helpers ──
def page_file(page_num: int) -> str:
    """books/ocr_pages/page_001.txt"""
    return os.path.join(PAGES_DIR, f'page_{page_num:03d}.txt')

def is_page_done(page_num: int) -> bool:
    """文件存在即代表该页已完成，无需额外 progress.json"""
    return os.path.exists(page_file(page_num))

async def save_page(page_num: int, text: str):
    """将一页 OCR 结果写入独立文件"""
    filepath = page_file(page_num)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

# ── Failure Logger ──
class FailureLogger:
    def __init__(self):
        self._lock = asyncio.Lock()

    async def log(self, page: int, reason: str):
        async with self._lock:
            with open(FAILED_LOG, 'a', encoding='utf-8') as f:
                f.write(f"{page}\t{reason}\n")

    @staticmethod
    def load_failed_pages() -> list[int]:
        if not os.path.exists(FAILED_LOG): return []
        pages = set()
        with open(FAILED_LOG, 'r') as f:
            for line in f:
                parts = line.strip().split('\t')
                if parts:
                    try: pages.add(int(parts[0]))
                    except ValueError: pass
        return sorted(pages)

# ── PDF → base64 ──
def pdf_page_to_base64(doc, page_idx: int, dpi=200) -> str:
    page = doc[page_idx]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat)
    return base64.b64encode(pix.tobytes("png")).decode('utf-8')

# ── OCR Prompt ──
OCR_PROMPT = """请将这张图片中的所有文字完整、逐字逐句地提取出来。
要求：
1. 保留原始的题号（如 101. 102. 等）
2. 保留选项格式 (A) (B) (C) (D)
3. 保留中文解析部分
4. 不要添加任何你自己的解释或总结
5. 严格按照图片中的原始文字顺序输出
6. 如果有下划线或空白处，用 _______ 表示"""

# ── Single Page OCR with Retry ──
async def ocr_single_page(
    client: openai.OpenAI,
    model_name: str,
    doc,
    page_num: int,  # 1-indexed
    dpi: int,
    _unused1,  # kept for call-site compatibility
    _unused2,  # kept for call-site compatibility
    failures: FailureLogger,
    semaphore: asyncio.Semaphore,
    stats: dict,
):
    if is_page_done(page_num):
        return

    async with semaphore:
        # Render in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        img_b64 = await loop.run_in_executor(None, pdf_page_to_base64, doc, page_num - 1, dpi)

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                resp = await loop.run_in_executor(
                    None,
                    lambda: client.chat.completions.create(
                        model=model_name,
                        messages=[{
                            "role": "user",
                            "content": [
                                {"type": "text", "text": OCR_PROMPT},
                                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
                            ]
                        }],
                        max_tokens=4000,
                        temperature=0.1
                    )
                )
                text = resp.choices[0].message.content or ""

                await save_page(page_num, text)

                stats['success'] += 1
                done = stats['success'] + stats['failed']
                total = stats['total']
                print(f"  ✅ Page {page_num:>3} ({len(text):>5} chars) [{done}/{total}]")
                return

            except Exception as e:
                err_msg = str(e).lower()
                is_rate_limit = '429' in err_msg or 'rate limit' in err_msg or 'too many' in err_msg
                is_server_err = '503' in err_msg or '502' in err_msg or 'unavailable' in err_msg

                if is_rate_limit:
                    wait = RATE_LIMIT_PAUSE_S * attempt
                    print(f"  ⏳ Page {page_num}: 429 Rate Limit, waiting {wait}s (attempt {attempt}/{MAX_RETRIES})")
                    await asyncio.sleep(wait)
                elif is_server_err:
                    wait = 60 * attempt
                    print(f"  🔴 Page {page_num}: Server Error, waiting {wait}s (attempt {attempt}/{MAX_RETRIES})")
                    await asyncio.sleep(wait)
                elif attempt < MAX_RETRIES:
                    wait = BASE_RETRY_DELAY_S * (2 ** (attempt - 1))
                    print(f"  ⚠️  Page {page_num}: Error, retry in {wait}s (attempt {attempt}/{MAX_RETRIES}): {e}")
                    await asyncio.sleep(wait)
                else:
                    print(f"  ❌ Page {page_num}: FAILED after {MAX_RETRIES} attempts: {e}")
                    await failures.log(page_num, str(e)[:200])
                    stats['failed'] += 1
                    return

        # All retries exhausted
        await failures.log(page_num, "All retries exhausted")
        stats['failed'] += 1

# ── Merge all page files into one (ordered by page number) ──
def merge_pages():
    if not os.path.exists(PAGES_DIR):
        print("❌ No ocr_pages directory found!"); return

    files = sorted(os.listdir(PAGES_DIR))
    if not files:
        print("❌ No page files found!"); return

    merged = ""
    count = 0
    for fname in files:
        if not fname.startswith('page_') or not fname.endswith('.txt'):
            continue
        page_num = int(fname.replace('page_', '').replace('.txt', ''))
        filepath = os.path.join(PAGES_DIR, fname)
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
        merged += f"\n\n--- PAGE {page_num} ---\n{text}"
        count += 1

    with open(MERGED_FILE, 'w', encoding='utf-8') as f:
        f.write(merged.strip())

    print(f"✅ Merged {count} pages → {MERGED_FILE}")

# ── Main ──
async def async_main(args):
    load_env()

    api_key = os.environ.get('ETL_API_KEY')
    base_url = os.environ.get('ETL_BASE_URL')
    model_name = os.environ.get('ETL_MODEL_NAME', 'gemini-3-flash')
    if not api_key or not base_url:
        print("❌ ETL_API_KEY / ETL_BASE_URL not in .env!"); sys.exit(1)

    # Ensure output directory exists
    os.makedirs(PAGES_DIR, exist_ok=True)

    client = openai.OpenAI(api_key=api_key, base_url=base_url)

    doc = fitz.open(PDF_PATH)
    total_pages = len(doc)

    print("=" * 60)
    print("  Opus TOEIC PDF OCR Pipeline (Per-Page)")
    print("=" * 60)
    print(f"  🤖 Model:   {model_name} @ {base_url}")
    print(f"  📄 PDF:     {total_pages} pages")
    print(f"  🧵 Workers: {args.workers} (concurrent)")
    print(f"  � Output:  {PAGES_DIR}/page_XXX.txt")
    print(f"  📋 Failed:  {FAILED_LOG}")
    print("=" * 60)

    # Determine pages
    if args.retry:
        pages = FailureLogger.load_failed_pages()
        if not pages:
            print("✅ No failed pages to retry!"); return
        print(f"🔄 Retrying {len(pages)} failed pages")
        if os.path.exists(FAILED_LOG):
            os.remove(FAILED_LOG)
    else:
        end = args.end_page if args.end_page > 0 else total_pages
        pages = list(range(args.start_page, end + 1))

    failures = FailureLogger()
    semaphore = asyncio.Semaphore(args.workers)

    # Filter already done (file exists = done)
    remaining = [p for p in pages if not is_page_done(p)]
    skipped = len(pages) - len(remaining)
    if skipped > 0:
        print(f"⏭️  Skipping {skipped} already-completed pages")
    print(f"📖 Processing {len(remaining)} pages...\n")

    stats = {'success': 0, 'failed': 0, 'total': len(remaining)}
    start_time = time.time()

    # Launch all tasks with concurrency controlled by semaphore
    tasks = [
        ocr_single_page(client, model_name, doc, p, args.dpi, None, None, failures, semaphore, stats)
        for p in remaining
    ]
    await asyncio.gather(*tasks)

    elapsed = time.time() - start_time
    print(f"\n{'=' * 60}")
    print(f"  🎉 Done!")
    print(f"  ✅ Success: {stats['success']}")
    print(f"  ❌ Failed:  {stats['failed']}")
    print(f"  ⏱️  Time:    {elapsed:.0f}s ({elapsed/60:.1f}min)")
    if stats['failed'] > 0:
        print(f"  💡 Run with --retry to retry failed pages")
    print(f"  💡 Run with --merge to combine into one file")
    print(f"{'=' * 60}")

def main():
    parser = argparse.ArgumentParser(description='Opus TOEIC PDF OCR (Parallel)')
    parser.add_argument('--start-page', type=int, default=1)
    parser.add_argument('--end-page', type=int, default=0, help='0=last page')
    parser.add_argument('--workers', type=int, default=4, help='并发线程数')
    parser.add_argument('--dpi', type=int, default=200)
    parser.add_argument('--retry', action='store_true', help='重试失败页')
    parser.add_argument('--merge', action='store_true', help='合并所有页面文件为一个完整文件')
    args = parser.parse_args()

    if args.merge:
        merge_pages()
        return

    asyncio.run(async_main(args))

if __name__ == '__main__':
    main()
