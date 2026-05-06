/**
 * Session 共享策略模块
 * 功能：
 *   集中定义训练模式到学习轨道的映射，避免 Web、H5、iOS 适配层规则漂移。
 */
import type { SessionMode } from "@/types/briefing";

export type SessionTrack = "VISUAL" | "AUDIO" | "CONTEXT";

const OUTCOME_VISUAL_MODES = new Set<string>([
    "SYNTAX",
    "VISUAL",
    "BLITZ",
    "PHRASE",
    "CHUNKING",
    "ARENA_PART5",
    "ARENA_PART6",
]);

const SELECTION_AUDIO_MODES = new Set<string>([
    "AUDIO",
    "CHUNKING",
]);

const CONTEXT_MODES = new Set<string>([
    "CONTEXT",
    "NUANCE",
    "READING",
]);

export function resolveOutcomeTrack(mode?: SessionMode | string): SessionTrack {
    if (!mode) return "VISUAL";
    if (OUTCOME_VISUAL_MODES.has(mode)) return "VISUAL";
    if (mode === "AUDIO") return "AUDIO";
    if (CONTEXT_MODES.has(mode)) return "CONTEXT";
    return "VISUAL";
}

export function resolveSelectionTrack(mode?: SessionMode | string): SessionTrack {
    if (!mode) return "VISUAL";
    if (SELECTION_AUDIO_MODES.has(mode)) return "AUDIO";
    return resolveOutcomeTrack(mode);
}

export const resolveSessionTrack = resolveOutcomeTrack;
