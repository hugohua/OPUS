"""
pytest 公共配置和 Fixtures

用于创建 Mock 和共享测试资源
"""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
import tempfile
from pathlib import Path


# 模拟的 PCM 音频数据 (1秒 24kHz 16-bit mono = 48000 bytes)
MOCK_PCM_DATA = b'\x00\x80' * 24000  # 简单的静音采样


@pytest.fixture(scope="module")
def client():
    """创建 FastAPI 测试客户端"""
    from main import app
    return TestClient(app)


@pytest.fixture
def mock_dashscope():
    """
    Mock DashScope API
    
    使用方式:
        def test_xxx(mock_dashscope):
            # DashScope 已被 Mock，不会调用真实 API
    """
    with patch('services.dashscope.dashscope') as mock:
        # 模拟成功响应
        mock_synthesizer = MagicMock()
        mock_synthesizer.call.return_value = MagicMock(
            output={'audio': {'data': MOCK_PCM_DATA}},
            status_code=200
        )
        mock.audio.tts_v2.SpeechSynthesizer.return_value = mock_synthesizer
        
        yield mock


@pytest.fixture
def mock_dashscope_timeout():
    """
    Mock DashScope API 超时
    """
    with patch('services.dashscope.dashscope') as mock:
        from requests.exceptions import Timeout
        mock.audio.tts_v2.SpeechSynthesizer.side_effect = Timeout("Connection timed out")
        yield mock


@pytest.fixture
def mock_dashscope_error():
    """
    Mock DashScope API 错误响应
    """
    with patch('services.dashscope.dashscope') as mock:
        mock_synthesizer = MagicMock()
        mock_synthesizer.call.return_value = MagicMock(
            output=None,
            status_code=500,
            message="Internal Server Error"
        )
        mock.audio.tts_v2.SpeechSynthesizer.return_value = mock_synthesizer
        yield mock


@pytest.fixture
def temp_cache_dir():
    """
    创建临时缓存目录
    
    测试结束后自动清理
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_config(temp_cache_dir):
    """
    Mock 配置，使用临时目录
    """
    with patch('core.config.Config') as mock:
        mock.CACHE_DIR = temp_cache_dir
        mock.AUDIO_FORMAT = "wav"
        mock.validate.return_value = None
        yield mock
