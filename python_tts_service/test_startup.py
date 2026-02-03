"""
测试启动脚本

快速测试 TTS 服务是否能正常启动（不需要真实的 DashScope API）
"""
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.hash import generate_audio_hash
from core.config import Config
from pathlib import Path
import tempfile

# 本地开发时使用临时目录
def get_test_config():
    """获取测试配置"""
    test_config = Config()
    # 如果 /app 不存在（本地开发），使用临时目录
    if not Path("/app").exists():
        test_config.CACHE_DIR = Path(tempfile.gettempdir()) / "opus_tts_cache"
    return test_config

config = get_test_config()


def test_hash():
    """测试 Hash 生成"""
    print("🔍 测试 Hash 生成...")
    hash1 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
    hash2 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
    
    assert hash1 == hash2, "Hash 一致性测试失败"
    assert len(hash1) == 32, "Hash 长度错误"
    print(f"✅ Hash 生成测试通过: {hash1}")


def test_config():
    """测试配置加载"""
    print("\n🔍 测试配置加载...")
    print(f"  TTS Model: {config.TTS_MODEL}")
    print(f"  Default Voice: {config.DEFAULT_VOICE}")
    print(f"  Default Language: {config.DEFAULT_LANGUAGE}")
    print(f"  Max Text Length: {config.MAX_TEXT_LENGTH}")
    print(f"  Cache Dir: {config.CACHE_DIR}")
    print(f"  TTS API Key: {'✅ 已配置' if config.OPENAI_API_KEY else '❌ 未配置'}")
    print("✅ 配置加载测试通过")


def test_cache_dir():
    """测试缓存目录"""
    print("\n🔍 测试缓存目录...")
    cache_dir = config.CACHE_DIR
    
    if not cache_dir.exists():
        print(f"  创建缓存目录: {cache_dir}")
        cache_dir.mkdir(parents=True, exist_ok=True)
    
    assert cache_dir.exists(), "缓存目录创建失败"
    print(f"✅ 缓存目录测试通过: {cache_dir}")


if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Opus TTS Service - 快速测试")
    print("=" * 60)
    
    try:
        test_hash()
        test_config()
        test_cache_dir()
        
        print("\n" + "=" * 60)
        print("✅ 所有测试通过！服务可以启动。")
        print("=" * 60)
        print("\n下一步:")
        print("  1. 启动服务: uvicorn main:app --reload")
        print("  2. 访问文档: http://localhost:8000/docs")
        print("  3. 健康检查: curl http://localhost:8000/tts/health")
        
    except Exception as e:
        print("\n" + "=" * 60)
        print(f"❌ 测试失败: {e}")
        print("=" * 60)
        sys.exit(1)
