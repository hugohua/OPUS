/**
 * Blitz 模式验证模块
 * 功能：
 *   定义 Phrase Blitz 相关的 Zod Schema DTO
 *   用于 Server Action 返回数据的类型校验
 */
import { z } from 'zod';

export const BlitzItemSchema = z.object({
    id: z.string().cuid(), // UserProgress ID
    vocabId: z.number().int(),
    word: z.string(),
    frequency_score: z.number().int().default(0),
    context: z.object({
        text: z.string(), // Full sentence
        maskedText: z.string(), // Masked sentence (_______)
        translation: z.string(), // CN Translation
    }),
});

export const BlitzSessionSchema = z.object({
    sessionId: z.string().cuid(),
    items: z.array(BlitzItemSchema),
});

export type BlitzItem = z.infer<typeof BlitzItemSchema>;
export type BlitzSessionData = z.infer<typeof BlitzSessionSchema>;
