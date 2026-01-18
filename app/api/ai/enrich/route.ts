import { NextRequest, NextResponse } from 'next/server';
import { VocabularyAIService } from '@/lib/ai';
import { VocabularyInputSchema } from '@/lib/validations/ai';
import { z } from 'zod';

const RequestSchema = z.object({
    inputs: z.array(VocabularyInputSchema),
});

/**
 * POST /api/ai/enrich
 * 
 * 外部 API 调用入口（用于 Webhooks 或非 React 客户端）
 * 
 * Request Body:
 * {
 *   "inputs": [
 *     { "word": "abandon", "def_en": "to leave completely" }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { inputs } = RequestSchema.parse(body);

        const service = new VocabularyAIService();
        const result = await service.enrichVocabulary(inputs);

        return NextResponse.json({ status: 'success', data: result });
    } catch (error) {
        console.error('[API /ai/enrich Error]', error);

        const message = error instanceof Error ? error.message : 'Unknown error';
        const status = error instanceof z.ZodError ? 400 : 500;

        return NextResponse.json(
            { status: 'error', message },
            { status }
        );
    }
}
