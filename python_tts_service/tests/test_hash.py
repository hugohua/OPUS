"""
Hash 生成工具的单元测试

⚠️ 确保 Hash 算法与前端保持一致
"""
import pytest
from core.hash import generate_audio_hash


class TestAudioHash:
    """音频 Hash 生成测试"""
    
    def test_hash_consistency(self):
        """相同输入应产生相同 Hash"""
        hash1 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
        hash2 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
        assert hash1 == hash2
    
    def test_hash_uniqueness_text(self):
        """不同文本应产生不同 Hash"""
        hash1 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
        hash2 = generate_audio_hash("World", "Cherry", "en-US", 1.0)
        assert hash1 != hash2
    
    def test_hash_uniqueness_voice(self):
        """不同声音应产生不同 Hash"""
        hash1 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
        hash2 = generate_audio_hash("Hello", "Alice", "en-US", 1.0)
        assert hash1 != hash2
    
    def test_hash_uniqueness_language(self):
        """不同语言应产生不同 Hash"""
        hash1 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
        hash2 = generate_audio_hash("Hello", "Cherry", "zh-CN", 1.0)
        assert hash1 != hash2
    
    def test_hash_uniqueness_speed(self):
        """不同速度应产生不同 Hash"""
        hash1 = generate_audio_hash("Hello", "Cherry", "en-US", 1.0)
        hash2 = generate_audio_hash("Hello", "Cherry", "en-US", 1.5)
        assert hash1 != hash2
    
    def test_hash_format(self):
        """Hash 应为 32 位小写十六进制字符串"""
        hash_value = generate_audio_hash("Test", "Cherry", "en-US", 1.0)
        assert len(hash_value) == 32
        assert hash_value.islower()
        assert all(c in '0123456789abcdef' for c in hash_value)
    
    def test_default_parameters(self):
        """测试默认参数"""
        hash1 = generate_audio_hash("Test")
        hash2 = generate_audio_hash("Test", "Cherry", "en-US", 1.0)
        assert hash1 == hash2
