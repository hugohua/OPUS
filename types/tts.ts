export interface TTSRequest {
    text: string;
    voice?: string;    // 默认: Cherry
    language?: string; // 默认: en-US
    speed?: number;    // 默认: 1.0 (0.5 - 2.0)
}

export interface TTSResponse {
    success: boolean;
    error?: string;
    cached?: boolean;
    hash?: string;
    url?: string;
    file_size?: number;
    duration?: number;
}

export type TTSStatus = 'idle' | 'loading' | 'playing' | 'error';

export interface TTSState {
    status: TTSStatus;
    url: string | null;
    error: string | null;
    duration: number; // 秒
    currentTime: number; // 秒
}
