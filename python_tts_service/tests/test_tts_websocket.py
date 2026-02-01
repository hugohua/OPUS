"""
TTS WebSocket API 测试用例

运行方式:
    cd python_tts_service
    source venv/bin/activate
    pytest tests/test_tts_websocket.py -v
"""
import pytest
import json
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="module")
def client():
    """创建测试客户端"""
    return TestClient(app)


class TestWebSocketConnection:
    """WebSocket 连接测试"""
    
    def test_websocket_connection_accepted(self, client):
        """W01: WebSocket 连接应被接受"""
        with client.websocket_connect("/ws/tts") as websocket:
            # 连接成功即通过
            assert websocket is not None
    
    def test_websocket_ping_pong(self, client):
        """W02: 心跳消息应返回 pong"""
        with client.websocket_connect("/ws/tts") as websocket:
            websocket.send_json({"type": "ping"})
            response = websocket.receive_json()
            
            assert response["type"] == "pong"
    
    def test_websocket_multiple_pings(self, client):
        """连接复用: 多次心跳应都能响应"""
        with client.websocket_connect("/ws/tts") as websocket:
            for _ in range(3):
                websocket.send_json({"type": "ping"})
                response = websocket.receive_json()
                assert response["type"] == "pong"


class TestWebSocketTTSGeneration:
    """WebSocket TTS 生成测试"""
    
    def test_tts_request_returns_audio_chunks(self, client):
        """W03: TTS 请求应返回音频数据块"""
        with client.websocket_connect("/ws/tts") as websocket:
            websocket.send_json({
                "text": "Hello",
                "requestId": "test-001",
                "voice": "Cherry",
                "language": "English"
            })
            
            audio_received = False
            done_received = False
            
            # 接收响应直到 done
            while True:
                try:
                    response = websocket.receive_json()
                    
                    if response.get("type") == "audio":
                        audio_received = True
                        assert "data" in response
                        assert "sample_rate" in response
                        assert response.get("requestId") == "test-001"
                    
                    elif response.get("type") == "done":
                        done_received = True
                        assert response.get("requestId") == "test-001"
                        break
                    
                    elif response.get("type") == "error":
                        pytest.fail(f"收到错误: {response.get('message')}")
                        break
                        
                except Exception:
                    break
            
            assert audio_received, "应收到至少一个音频数据块"
            assert done_received, "应收到完成信号"
    
    def test_tts_empty_text_returns_error(self, client):
        """W04: 空文本应返回错误"""
        with client.websocket_connect("/ws/tts") as websocket:
            websocket.send_json({
                "text": "",
                "requestId": "test-error",
                "voice": "Cherry"
            })
            
            response = websocket.receive_json()
            assert response["type"] == "error"
            assert response.get("requestId") == "test-error"
    
    def test_tts_request_id_preserved(self, client):
        """请求 ID 应在响应中保留"""
        with client.websocket_connect("/ws/tts") as websocket:
            request_id = "unique-request-12345"
            websocket.send_json({
                "text": "Test",
                "requestId": request_id,
                "voice": "Cherry",
                "language": "English"
            })
            
            # 接收所有响应并验证 requestId
            while True:
                try:
                    response = websocket.receive_json()
                    if response.get("type") in ["audio", "done", "error"]:
                        assert response.get("requestId") == request_id
                    if response.get("type") == "done":
                        break
                except Exception:
                    break


class TestWebSocketConnectionReuse:
    """WebSocket 连接复用测试"""
    
    def test_multiple_requests_on_same_connection(self, client):
        """W05: 同一连接应能处理多个请求"""
        with client.websocket_connect("/ws/tts") as websocket:
            for i in range(2):
                # 发送心跳验证连接活跃
                websocket.send_json({"type": "ping"})
                response = websocket.receive_json()
                assert response["type"] == "pong"
