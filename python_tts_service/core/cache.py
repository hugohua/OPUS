"""
缓存管理模块
"""
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

import structlog

from .config import config

logger = structlog.get_logger()


class CacheManager:
    """音频文件缓存管理器"""
    
    def __init__(self, cache_dir: Path = None):
        self.cache_dir = cache_dir or config.CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.metadata_file = self.cache_dir / "metadata.json"
        self._metadata_cache: Optional[Dict] = None
    
    def get_audio_path(self, hash_key: str) -> Path:
        """获取音频文件路径"""
        return self.cache_dir / f"{hash_key}.{config.AUDIO_FORMAT}"
    
    def exists(self, hash_key: str) -> bool:
        """检查缓存是否存在"""
        audio_path = self.get_audio_path(hash_key)
        exists = audio_path.exists() and audio_path.stat().st_size > 0
        
        if exists:
            logger.info("cache_hit", hash=hash_key)
        else:
            logger.info("cache_miss", hash=hash_key)
        
        return exists
    
    def save_audio(
        self,
        hash_key: str,
        audio_data: bytes,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Path:
        """
        保存音频文件到缓存
        
        Args:
            hash_key: 音频 Hash
            audio_data: 音频二进制数据
            metadata: 可选的元数据
            
        Returns:
            Path: 保存的文件路径
        """
        audio_path = self.get_audio_path(hash_key)
        
        # 保存音频文件
        with open(audio_path, 'wb') as f:
            f.write(audio_data)
        
        # 保存元数据（可选）
        if metadata:
            self._save_metadata(hash_key, metadata)
        
        file_size = audio_path.stat().st_size
        logger.info(
            "audio_cached",
            hash=hash_key,
            size_bytes=file_size,
            path=str(audio_path)
        )
        
        return audio_path
    
    def get_metadata(self, hash_key: str) -> Optional[Dict[str, Any]]:
        """获取音频元数据"""
        metadata = self._load_metadata()
        return metadata.get(hash_key)
    
    def _load_metadata(self) -> Dict:
        """加载元数据文件"""
        if self._metadata_cache is not None:
            return self._metadata_cache
        
        if not self.metadata_file.exists():
            self._metadata_cache = {}
            return self._metadata_cache
        
        try:
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                self._metadata_cache = json.load(f)
        except json.JSONDecodeError:
            logger.warning("metadata_corrupted", path=str(self.metadata_file))
            self._metadata_cache = {}
        
        return self._metadata_cache
    
    def _save_metadata(self, hash_key: str, metadata: Dict[str, Any]):
        """保存元数据"""
        all_metadata = self._load_metadata()
        
        # 添加时间戳
        metadata['created_at'] = datetime.utcnow().isoformat()
        metadata['hash'] = hash_key
        
        all_metadata[hash_key] = metadata
        
        # 写入文件
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(all_metadata, f, indent=2, ensure_ascii=False)
        
        # 更新缓存
        self._metadata_cache = all_metadata
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        audio_files = list(self.cache_dir.glob(f"*.{config.AUDIO_FORMAT}"))
        total_size = sum(f.stat().st_size for f in audio_files)
        
        return {
            "total_files": len(audio_files),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "cache_dir": str(self.cache_dir)
        }


# 全局缓存管理器实例
cache_manager = CacheManager()
