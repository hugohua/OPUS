'use server';

import { VocabularyAIService } from '@/lib/ai';
import { VocabularyInputSchema } from '@/lib/validations/ai';
import type { ActionState, VocabularyResult } from '@/types';
import { z } from 'zod';

const EnrichInputSchema = z.array(VocabularyInputSchema);

/**
 * 词汇增强 Server Action
 * 
 * 调用 AI 服务增强词汇元数据
 * 
 * @param inputs - 待处理的词汇列表
 * @returns ActionState<VocabularyResult>
 */
export async function enrichVocabularyAction(
    inputs: z.infer<typeof EnrichInputSchema>
): Promise<ActionState<VocabularyResult>> {
    try {
        // 1. 输入验证（规范 4.A）
        const validated = EnrichInputSchema.parse(inputs);

        // 2. 调用服务
        const service = new VocabularyAIService();
        const result = await service.enrichVocabulary(validated);

        // 3. 标准返回格式
        return {
            status: 'success',
            message: `成功处理 ${result.items.length} 个词汇`,
            data: result,
        };
    } catch (error) {
        console.error('[AI Action Error]', error);

        if (error instanceof z.ZodError) {
            return {
                status: 'error',
                message: '输入验证失败',
                fieldErrors: error.flatten().fieldErrors as Record<string, string>,
            };
        }

        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'AI 服务调用失败',
        };
    }
}
