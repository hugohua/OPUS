import 'dotenv/config';
import { AIService } from '@/lib/ai/core';
import { z } from 'zod';

/**
 * 强制触发 generateObject 调用，测试增强后的 Failover 审计
 */
async function main() {
    console.log('=== 强制触发 generateObject (测试 Failover 审计) ===');
    console.log(`AI_FAST_ORDER: ${process.env.AI_FAST_ORDER}`);

    try {
        const { object, provider } = await AIService.generateObject({
            mode: 'fast',
            schema: z.object({
                drills: z.array(z.object({
                    meta: z.object({
                        format: z.enum(['chat', 'email', 'memo']),
                        target_word: z.string()
                    }),
                    segments: z.array(z.any())
                }))
            }),
            system: 'You are a drill generator.',
            prompt: 'Generate 1 simple drill for the word "test".'
        });

        console.log(`\n✅ Provider: ${provider}`);
        console.log(`Result:`, JSON.stringify(object, null, 2));

    } catch (error) {
        console.error(`\n❌ All providers failed:`, error);
    }
}

main().catch(console.error);
