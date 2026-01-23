/**
 * useTTS Hook (Placeholder)
 * 功能：
 *   提供 TTS 接口，后续对接 CosyVoice 或 Web Speech API。
 *   目前仅打印日志，不执行实际音频播放。
 */
'use client';

export function useTTS() {
    const speak = (text: string) => {
        // Placeholder operations
        // console.log('[TTS] Speaking:', text);
    };

    const cancel = () => {
        // console.log('[TTS] Cancelled');
    };

    return { speak, cancel };
}
