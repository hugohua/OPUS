"""
TTS HTTP REST API 测试用例

运行方式:
    cd python_tts_service
    source venv/bin/activate
    pytest tests/test_tts_api.py -v
"""
import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client():
    """创建测试客户端"""
    return TestClient(app)


class TestHealthCheck:
    """健康检查接口测试"""
    
    def test_health_endpoint_returns_200(self, client):
        """H00: 健康检查应返回 200"""
        response = client.get("/tts/health")
        assert response.status_code == 200
    
    def test_health_response_structure(self, client):
        """健康检查响应应包含必要字段"""
        response = client.get("/tts/health")
        data = response.json()
        
        assert "status" in data
        assert "service" in data
        assert "version" in data
        assert "dashscope_connected" in data
    
    def test_health_shows_healthy_status(self, client):
        """API Key 配置后状态应为 healthy"""
        response = client.get("/tts/health")
        data = response.json()
        
        assert data["status"] == "healthy"
        assert data["dashscope_connected"] is True


class TestTTSGenerate:
    """TTS 生成接口测试"""
    
    def test_generate_with_valid_text(self, client):
        """H01: 正常文本应生成音频"""
        response = client.post(
            "/tts/generate",
            json={
                "text": "Hello world",
                "voice": "Cherry",
                "language": "en-US"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["success"] is True
        assert "hash" in data
        assert "url" in data
        assert data["file_size"] > 0
    
    def test_generate_cache_hit(self, client):
        """H02: 重复请求应命中缓存"""
        payload = {
            "text": "Cache test sentence",
            "voice": "Cherry",
            "language": "en-US"
        }
        
        # 第一次请求
        response1 = client.post("/tts/generate", json=payload)
        assert response1.status_code == 200
        data1 = response1.json()
        
        # 第二次请求（应命中缓存）
        response2 = client.post("/tts/generate", json=payload)
        assert response2.status_code == 200
        data2 = response2.json()
        
        assert data2["cached"] is True
        assert data1["hash"] == data2["hash"]
    
    def test_generate_empty_text_rejected(self, client):
        """H03: 空文本应返回 422"""
        response = client.post(
            "/tts/generate",
            json={"text": "", "voice": "Cherry"}
        )
        assert response.status_code == 422
    
    def test_generate_with_different_voices(self, client):
        """不同音色应生成不同 Hash"""
        text = "Voice test"
        
        response1 = client.post(
            "/tts/generate",
            json={"text": text, "voice": "Cherry", "language": "en-US"}
        )
        response2 = client.post(
            "/tts/generate",
            json={"text": text, "voice": "Alice", "language": "en-US"}
        )
        
        # 注意：如果 API 不支持该音色可能会失败
        if response1.status_code == 200 and response2.status_code == 200:
            assert response1.json()["hash"] != response2.json()["hash"]
    
    def test_generate_returns_valid_audio_url(self, client):
        """生成的 URL 应该可访问"""
        response = client.post(
            "/tts/generate",
            json={"text": "URL test", "voice": "Cherry", "language": "en-US"}
        )
        assert response.status_code == 200
        
        data = response.json()
        url = data["url"]
        
        # URL 格式验证
        assert url.startswith("/audio/")
        assert url.endswith(".wav")


class TestCacheCheck:
    """缓存检查接口测试"""
    
    def test_check_existing_cache(self, client):
        """检查已存在的缓存"""
        # 先生成一个音频
        gen_response = client.post(
            "/tts/generate",
            json={"text": "Check cache test", "voice": "Cherry", "language": "en-US"}
        )
        assert gen_response.status_code == 200
        audio_hash = gen_response.json()["hash"]
        
        # 检查缓存
        check_response = client.get(f"/tts/check/{audio_hash}")
        assert check_response.status_code == 200
        
        data = check_response.json()
        assert data["exists"] is True
        assert "url" in data
    
    def test_check_nonexistent_cache(self, client):
        """检查不存在的缓存"""
        response = client.get("/tts/check/nonexistent_hash_12345")
        assert response.status_code == 200
        
        data = response.json()
        assert data["exists"] is False


class TestCacheStats:
    """缓存统计接口测试"""
    
    def test_stats_endpoint(self, client):
        """统计接口应返回正确结构"""
        response = client.get("/tts/stats")
        assert response.status_code == 200
        
        data = response.json()
        assert "total_files" in data
        assert "total_size_bytes" in data
        assert "cache_dir" in data
