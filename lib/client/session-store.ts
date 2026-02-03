/**
 * SessionStore - 客户端会话存储
 * 功能：
 *   基于 LocalStorage 管理 Session 进度
 *   支持保存、恢复、清理 Session 状态
 *   包含 24 小时过期机制
 */
import { z } from 'zod';
import { BriefingPayload, SessionMode } from '@/types/briefing';

// --- Schema Definition ---
// 为了确保存储数据的安全性，使用 Zod 进行校验
const SessionStateSchema = z.object({
    mode: z.enum(['SYNTAX', 'CHUNKING', 'NUANCE']),
    queue: z.array(z.any()), // BriefingPayload 结构比较复杂，暂时用 any，实际使用时强转
    currentIndex: z.number(),
    lastUpdated: z.number(), // Timestamp
});

export type SessionState = {
    mode: SessionMode;
    queue: BriefingPayload[];
    currentIndex: number;
    lastUpdated: number;
}

const STORAGE_PREFIX = 'opus_session_v2_';
const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24 Hours

/**
 * 保存 Session 状态
 */
export function saveSession(userId: string, mode: SessionMode, queue: BriefingPayload[], currentIndex: number) {
    if (typeof window === 'undefined') return;

    const key = getKey(userId, mode);
    const state: SessionState = {
        mode,
        queue,
        currentIndex,
        lastUpdated: Date.now(),
    };

    try {
        localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save session to localStorage', e);
        // QuotaExceededError is possible but unlikely for this json size
    }
}

/**
 * 恢复 Session 状态
 * 返回 null 如果不存在或已过期
 */
export function loadSession(userId: string, mode: SessionMode): SessionState | null {
    if (typeof window === 'undefined') return null;

    const key = getKey(userId, mode);
    const raw = localStorage.getItem(key);

    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        const result = SessionStateSchema.safeParse(parsed);

        if (!result.success) {
            console.warn('Session storage corrupted, clearing', result.error);
            localStorage.removeItem(key);
            return null;
        }

        const state = result.data as SessionState;

        // Check Expiry
        if (Date.now() - state.lastUpdated > EXPIRE_MS) {
            console.debug('[SessionStore] Expired, clearing:', key);
            localStorage.removeItem(key);
            return null;
        }

        // Check if finished? 
        // No, let component decide if currentIndex >= queue.length

        return state;

    } catch (e) {
        console.error('Failed to load session', e);
        return null;
    }
}

/**
 * 清除 Session 状态
 * (通常在 Session 完成或用户主动退出时调用)
 */
export function clearSession(userId: string, mode: SessionMode) {
    if (typeof window === 'undefined') return;
    const key = getKey(userId, mode);
    localStorage.removeItem(key);
}

function getKey(userId: string, mode: SessionMode) {
    return `${STORAGE_PREFIX}${userId}_${mode}`;
}
