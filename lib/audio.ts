export const formatUkAudioUrl = (filename: string) => {
    if (!filename) return "";
    // 假设音频文件托管在 public/audio 或 CDN 上
    // 这里暂时返回本地路径占位
    return `/audio/uk/${filename}`;
};
