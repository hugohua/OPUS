'use server';

/**
 * SmartContent Generator Action
 * 
 * 用于 Word Detail Page 的 ContextSnapshot 模块
 * 流程: Cache-First → 批量 LLM 生成 (6 场景) → 文本优先返回 → TTS 异步填充
 */

import { prisma } from '@/lib/db';
import { auth } from '@/auth';
import { AIService } from '@/lib/ai/core';
import { createLogger } from '@/lib/logger';
import {
    L2SentencePayloadSchema,
    L2BatchPayloadSchema,
    L2_SMART_CONTENT_SYSTEM_PROMPT,
    buildL2BatchUserPrompt,
    getDeterministicL2,
    getDeterministicL2Batch,
    L2_SCENARIOS,
    type L2SentencePayload,
} from '@/lib/generators/l2/smart-content';
import { getTTSAudioCore as getTTSAudio } from '@/lib/tts/service';

const log = createLogger('content-generator');

// ============================================================
// 主函数: 获取或生成 L2 例句 (批量预填充策略)
// ============================================================

interface SmartContentResult {
    id?: string;
    text: string;
    translation: string;
    scenario: string;
    audioUrl: string | null;
    fromCache: boolean;
}

export async function getOrGenerateL2Context(
    vocabId: number,
    word: string,
    definition?: string
): Promise<SmartContentResult> {
    // 0. Auth 检查
    const session = await auth();
    if (!session?.user?.id) {
        log.warn({ vocabId, word }, 'Unauthorized access attempt');
        return fallbackResponse(word, definition);
    }

    // 1. 查缓存 (优先返回任意一条已有内容)
    const cached = await prisma.smartContent.findFirst({
        where: { vocabId, type: 'L2_SENTENCE' },
        include: { ttsCache: { select: { url: true } } },
    });

    if (cached) {
        log.debug({ vocabId, word, cached: true }, 'SmartContent cache hit');
        return {
            id: cached.id,
            text: (cached.payload as L2SentencePayload).text,
            translation: (cached.payload as L2SentencePayload).translation,
            scenario: cached.scenario,
            audioUrl: cached.ttsCache?.url || null,
            fromCache: true,
        };
    }

    // 2. Cache Miss → 批量 LLM 生成 (一次生成 6 个场景)
    log.info({ vocabId, word }, 'SmartContent cache miss, batch generating 6 scenarios...');

    try {
        const { object, provider } = await AIService.generateObject({
            mode: 'fast',
            schema: L2BatchPayloadSchema,
            system: L2_SMART_CONTENT_SYSTEM_PROMPT,
            prompt: buildL2BatchUserPrompt(word, definition),
        });

        // 记录使用的 Provider
        log.info({ vocabId, provider }, 'SmartContent generated via AIService');

        // 3. Zod 校验
        const validated = L2BatchPayloadSchema.safeParse(object);
        if (!validated.success) {
            log.error({ word, issues: validated.error.issues }, 'LLM batch output validation failed');
            return fallbackResponse(word, definition);
        }

        const sentences = validated.data.sentences;

        // 4. 批量写入 DB (6 条记录)
        const records = await prisma.$transaction(
            sentences.map(payload =>
                prisma.smartContent.create({
                    data: {
                        vocabId,
                        type: 'L2_SENTENCE',
                        scenario: payload.scenario,
                        payload: payload,
                        model: provider,
                    },
                })
            )
        );

        log.info({ vocabId, word, count: records.length }, 'SmartContent batch created');

        // 5. 异步触发 TTS (只为第一条生成，其他按需)
        const firstRecord = records[0];
        triggerTTSGeneration(firstRecord.id, sentences[0].text).catch(err => {
            log.error({ err, contentId: firstRecord.id }, 'TTS generation failed');
        });

        // 6. 返回第一条
        return {
            id: firstRecord.id,
            text: sentences[0].text,
            translation: sentences[0].translation,
            scenario: sentences[0].scenario,
            audioUrl: null,
            fromCache: false,
        };

    } catch (error) {
        log.error({ error, word }, 'LLM batch generation failed, using fallback');
        return fallbackResponse(word, definition);
    }
}

// ============================================================
// 切换场景: 从已有缓存中轮换 (零 LLM 成本)
// ============================================================

export async function switchL2Scenario(
    vocabId: number,
    word: string,
    excludeScenario?: string
): Promise<SmartContentResult> {
    // 0. Auth 检查
    const session = await auth();
    if (!session?.user?.id) {
        return fallbackResponse(word);
    }

    // 1. 查询所有已缓存的场景
    const allCached = await prisma.smartContent.findMany({
        where: { vocabId, type: 'L2_SENTENCE' },
        include: { ttsCache: { select: { url: true } } },
    });

    // 2. 排除当前场景，随机选一个
    const available = allCached.filter(c => c.scenario !== excludeScenario);

    if (available.length > 0) {
        const picked = available[Math.floor(Math.random() * available.length)];

        // 异步触发 TTS (如果没有的话)
        if (!picked.ttsHash) {
            const payload = picked.payload as L2SentencePayload;
            triggerTTSGeneration(picked.id, payload.text).catch(() => { });
        }

        log.debug({ vocabId, scenario: picked.scenario }, 'Switched to cached scenario');

        return {
            id: picked.id,
            text: (picked.payload as L2SentencePayload).text,
            translation: (picked.payload as L2SentencePayload).translation,
            scenario: picked.scenario,
            audioUrl: picked.ttsCache?.url || null,
            fromCache: true,
        };
    }

    // 3. 没有可用缓存 → 触发批量生成
    log.info({ vocabId, word }, 'No cached scenarios, triggering batch generation');
    return getOrGenerateL2Context(vocabId, word);
}

// ============================================================
// 异步 TTS 生成
// ============================================================

async function triggerTTSGeneration(contentId: string, text: string) {
    const result = await getTTSAudio({
        text,
        voice: 'Cherry',
        language: 'en-US',
        speed: 1.0,
        cacheType: 'temporary',
    });

    // 回填 ttsHash 到 SmartContent
    await prisma.smartContent.update({
        where: { id: contentId },
        data: { ttsHash: result.hash },
    });

    log.debug({ contentId, hash: result.hash }, 'TTS generated and linked');
}

// ============================================================
// Fallback (降级兜底)
// ============================================================

function fallbackResponse(word: string, definition?: string): SmartContentResult {
    const fallback = getDeterministicL2(word, definition);
    return {
        ...fallback,
        audioUrl: null,
        fromCache: false,
    };
}

// ============================================================
// 轮询接口: 获取 SmartContent 的音频 URL
// ============================================================

export async function getSmartContentAudio(contentId: string): Promise<{ audioUrl: string | null }> {
    const record = await prisma.smartContent.findUnique({
        where: { id: contentId },
        include: { ttsCache: { select: { url: true } } },
    });

    return { audioUrl: record?.ttsCache?.url || null };
}
