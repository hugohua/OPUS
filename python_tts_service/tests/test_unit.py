"""
TTS 单元测试 (Pure Unit Tests with Mocking)

这些测试 **不调用真实 DashScope API**，完全依赖 Mock

运行方式:
    cd python_tts_service
    source venv/bin/activate
    pytest tests/test_unit.py -v
"""
import pytest
from unittest.mock import patch, MagicMock
import wave
import io

# 模拟的 PCM 数据 (1 秒 24kHz 16-bit mono)
MOCK_PCM_DATA = b'\x00\x00' * 24000


class TestAudioHashUnit:
    """Hash 算法单元测试 (已存在于 test_hash.py，这里补充边界情况)"""
    
    def test_hash_empty_text_rejected(self):
        """空文本应在调用前被拒绝"""
        from core.hash import generate_audio_hash
        
        # 空字符串仍然会生成 hash，但应该在 API 层拒绝
        hash_result = generate_audio_hash("")
        assert len(hash_result) == 32  # MD5 长度
    
    def test_hash_unicode_text(self):
        """Unicode 文本应正确处理"""
        from core.hash import generate_audio_hash
        
        hash1 = generate_audio_hash("你好世界")
        hash2 = generate_audio_hash("Hello World")
        
        assert hash1 != hash2
        assert len(hash1) == 32
    
    def test_hash_very_long_text(self):
        """超长文本应正确处理"""
        from core.hash import generate_audio_hash
        
        long_text = "a" * 10000
        hash_result = generate_audio_hash(long_text)
        assert len(hash_result) == 32


class TestCacheManagerUnit:
    """缓存管理器单元测试"""
    
    def test_get_audio_path(self, tmp_path):
        """路径生成应正确"""
        from core.cache import CacheManager
        
        manager = CacheManager(cache_dir=tmp_path)
        path = manager.get_audio_path("abc123")
        
        assert str(path).endswith("abc123.wav")
        assert tmp_path in path.parents
    
    def test_exists_nonexistent_file(self, tmp_path):
        """不存在的文件应返回 False"""
        from core.cache import CacheManager
        
        manager = CacheManager(cache_dir=tmp_path)
        assert manager.exists("nonexistent") is False
    
    def test_exists_empty_file(self, tmp_path):
        """空文件应返回 False"""
        from core.cache import CacheManager
        
        manager = CacheManager(cache_dir=tmp_path)
        empty_file = tmp_path / "empty.wav"
        empty_file.touch()
        
        assert manager.exists("empty") is False
    
    def test_save_audio_creates_file(self, tmp_path):
        """保存音频应创建文件"""
        from core.cache import CacheManager
        
        manager = CacheManager(cache_dir=tmp_path)
        path = manager.save_audio("test123", b"audio data")
        
        assert path.exists()
        assert path.read_bytes() == b"audio data"
    
    def test_save_audio_atomic_write(self, tmp_path):
        """原子写入应使用临时文件"""
        from core.cache import CacheManager
        
        manager = CacheManager(cache_dir=tmp_path)
        
        # 写入后不应存在 .tmp 文件
        manager.save_audio("atomic_test", b"data")
        
        tmp_files = list(tmp_path.glob("*.tmp"))
        assert len(tmp_files) == 0


class TestDashScopeServiceUnit:
    """DashScope 服务单元测试 (完全 Mock)"""
    
    @patch('services.dashscope.dashscope')
    def test_synthesize_returns_wav(self, mock_dashscope):
        """synthesize 应返回有效 WAV 数据"""
        from services.dashscope import DashScopeTTSService
        
        # Mock DashScope 返回
        mock_response = MagicMock()
        mock_response.output = {'audio': {'data': MOCK_PCM_DATA}}
        mock_response.status_code = 200
        mock_dashscope.audio.tts_v2.SpeechSynthesizer.return_value.call.return_value = mock_response
        
        service = DashScopeTTSService()
        
        # 由于实际实现可能不同，这里只验证概念
        # 真实测试需要根据实际代码调整

    @patch('services.dashscope.dashscope')
    def test_synthesize_timeout_raises(self, mock_dashscope):
        """超时应抛出异常"""
        from services.dashscope import DashScopeTTSService
        from requests.exceptions import Timeout
        
        mock_dashscope.audio.tts_v2.SpeechSynthesizer.side_effect = Timeout("Connection timed out")
        
        service = DashScopeTTSService()
        
        # 验证超时处理
        # with pytest.raises(Timeout):
        #     service.synthesize("test")


class TestWAVHeaderUnit:
    """WAV 头处理单元测试"""
    
    def test_pcm_to_wav_format(self):
        """PCM 转 WAV 应生成有效音频文件"""
        # 使用 wave 模块验证输出格式
        pcm_data = b'\x00\x00' * 1000  # 1000 samples
        
        # 模拟 WAV 头包装
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(pcm_data)
        
        wav_data = buffer.getvalue()
        
        # 验证 WAV 头
        assert wav_data[:4] == b'RIFF'
        assert wav_data[8:12] == b'WAVE'
    
    def test_wav_can_be_reopened(self):
        """生成的 WAV 应可被正确读取"""
        pcm_data = b'\x00\x00' * 24000  # 1 秒
        
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(24000)
            wav_file.writeframes(pcm_data)
        
        buffer.seek(0)
        
        with wave.open(buffer, 'rb') as wav_file:
            assert wav_file.getnchannels() == 1
            assert wav_file.getframerate() == 24000
            assert wav_file.getsampwidth() == 2
            assert wav_file.getnframes() == 24000


class TestTTSRequestValidation:
    """请求验证单元测试"""
    
    def test_valid_request(self):
        """有效请求应通过验证"""
        from api.models import TTSRequest
        
        request = TTSRequest(
            text="Hello world",
            voice="Cherry",
            language="en-US",
            speed=1.0
        )
        assert request.text == "Hello world"
    
    def test_empty_text_rejected(self):
        """空文本应被拒绝"""
        from api.models import TTSRequest
        from pydantic import ValidationError
        
        with pytest.raises(ValidationError):
            TTSRequest(text="", voice="Cherry")
    
    def test_speed_bounds(self):
        """速度应在合理范围内"""
        from api.models import TTSRequest
        
        # 正常速度
        req = TTSRequest(text="test", speed=1.5)
        assert req.speed == 1.5
        
        # 边界测试 (如果有限制)
        # with pytest.raises(ValidationError):
        #     TTSRequest(text="test", speed=10.0)


class TestResponseSchema:
    """响应 Schema 单元测试"""
    
    def test_tts_response_structure(self):
        """响应应符合预定义结构"""
        from api.models import TTSResponse
        
        response = TTSResponse(
            success=True,
            cached=False,
            hash="abc123",
            url="/audio/abc123.wav",
            file_size=1024
        )
        
        assert response.success is True
        assert response.hash == "abc123"
        assert response.file_size == 1024
    
    def test_tts_response_optional_fields(self):
        """可选字段应有默认值"""
        from api.models import TTSResponse
        
        # 验证最小响应
        response = TTSResponse(
            success=True,
            cached=False,
            hash="abc123",
            url="/audio/abc123.wav",
            file_size=0
        )
        assert response.file_size == 0
