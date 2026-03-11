"""
修复双重 WAV 头音频文件 (Fix Double RIFF Header)
=================================================

问题原因:
    DashScope WebSocket 返回的 base64 chunk 解码后已经是完整 WAV 数据(带 RIFF 头)，
    但 save_audio_file 又用 wave.open() 套了一层 WAV 头，导致文件中出现双重 RIFF 头。
    播放时第二个 RIFF 头字节被当做 PCM 采样，产生开头"哔"声杂音。

修复逻辑:
    扫描 public/audio/ 下所有 .wav 文件，检测是否存在双重 RIFF 头。
    如果是，去掉外层 44 字节的多余 WAV 头，保留内层完整 WAV 数据。

使用方法:
    python scripts/fix-double-wav-header.py              # 预览模式 (dry-run)
    python scripts/fix-double-wav-header.py --fix         # 实际修复
"""

import os
import sys
import argparse
import shutil
from pathlib import Path


def scan_and_fix(audio_dir: str, dry_run: bool = True):
    audio_path = Path(audio_dir)
    if not audio_path.exists():
        print(f"❌ 目录不存在: {audio_dir}")
        sys.exit(1)

    # 修复后的文件输出到同级 audio_fixed 目录
    fixed_dir = audio_path.parent / "audio_fixed"

    wav_files = list(audio_path.glob("*.wav"))
    print(f"📂 扫描目录: {audio_path}")
    print(f"📊 WAV 文件总数: {len(wav_files)}")
    print(f"🔧 模式: {'预览 (dry-run)' if dry_run else '实际修复'}")
    if not dry_run:
        print(f"📁 输出目录: {fixed_dir}")
    print("-" * 50)

    double_header_count = 0
    fixed_count = 0
    error_count = 0
    normal_count = 0
    mp3_disguised_count = 0

    for wav_file in wav_files:
        try:
            data = wav_file.read_bytes()
            if len(data) < 48:
                continue

            # 检查是否是伪装成 .wav 的 MP3 (Edge-TTS 生成)
            if data[:2] == b'\xff\xf3' or data[:2] == b'\xff\xfb':
                mp3_disguised_count += 1
                continue

            # 检查是否有双重 RIFF 头
            has_outer_riff = data[:4] == b'RIFF' and data[8:12] == b'WAVE'
            has_inner_riff = data[44:48] == b'RIFF' and data[52:56] == b'WAVE'

            if has_outer_riff and has_inner_riff:
                double_header_count += 1
                inner_data = data[44:]
                print(f"⚠️  双重头: {wav_file.name} ({len(data)}B → {len(inner_data)}B)")

                if not dry_run:
                    fixed_dir.mkdir(parents=True, exist_ok=True)
                    fixed_path = fixed_dir / wav_file.name
                    fixed_path.write_bytes(inner_data)
                    fixed_count += 1
                    print(f"   ✅ 已输出到: {fixed_path.name}")
            else:
                normal_count += 1

        except Exception as e:
            error_count += 1
            print(f"❌ 错误: {wav_file.name}: {e}")

    # 输出报告
    print("-" * 50)
    print("📋 扫描报告:")
    print(f"   正常 WAV 文件:     {normal_count}")
    print(f"   MP3 伪装文件:      {mp3_disguised_count}")
    print(f"   双重头问题文件:    {double_header_count}")
    if not dry_run:
        print(f"   已修复输出:        {fixed_count}")
    print(f"   错误:              {error_count}")

    if dry_run and double_header_count > 0:
        print(f"\n💡 发现 {double_header_count} 个问题文件。使用 --fix 参数执行修复:")
        print(f"   python scripts/fix-double-wav-header.py --fix")

    if not dry_run and fixed_count > 0:
        print(f"\n✅ 修复后的文件在: {fixed_dir}")
        print(f"   验证无误后，将文件复制回原目录: cp {fixed_dir}/*.wav {audio_path}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="修复双重 WAV 头音频文件")
    parser.add_argument("--dir", default="public/audio", help="音频目录 (默认: public/audio)")
    parser.add_argument("--fix", action="store_true", help="实际执行修复 (默认为预览模式)")
    args = parser.parse_args()

    # 确保相对路径基于项目根目录
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    audio_dir = (project_root / args.dir).resolve()

    scan_and_fix(str(audio_dir), dry_run=not args.fix)
