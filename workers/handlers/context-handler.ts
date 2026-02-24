import { AIService } from '@/lib/ai/core';
import { DrillCandidate, BatchDrillOutputSchema } from '../types';
import { logger as log } from '@/lib/logger';
import { ContextSelector } from '@/lib/ai/context-selector';
import { getL2ContextBatchPrompt, ContextGeneratorInput, ContextStage } from '@/lib/generators/l2/context-script';
import { buildPhraseFallbackDrill } from '@/lib/templates/phrase-fallback';

export async function processContextQueue(
    userId: string,
    contextGroup: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (contextGroup.length === 0) return;

    // Group by Stage for batch efficiency
    const stage1Inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[] = [];
    const stage2Inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[] = [];
    const stage3Inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[] = [];

    // Parallel context word fetching
    await Promise.all(contextGroup.map(async c => {
        const related = await ContextSelector.select(userId, c.vocabId, {
            count: 3,
            minDistance: 0.2,  // TASK3.md: 0.2-0.4 range
            maxDistance: 0.4
        });

        // 🎯 3-Stage Routing (TASK3.md)
        const stability = c.reviewData?.stability || 0;
        const lapses = c.reviewData?.lapses || 0;
        const isCritical = lapses >= 3; // 3+ lapses = Critical
        let stage: ContextStage = 1;
        if (stability >= 45 && !isCritical) stage = 2;
        if (isCritical) stage = 3;

        const input: ContextGeneratorInput & { candidate: DrillCandidate } = {
            targetWord: c.word,
            meaning: c.definition_cn || '暂无释义',
            contextWords: related.map(r => r.word),
            synonyms: c.synonyms || [],  // B3 Fix: Use type-safe access
            scenario: c.scenario || 'general office',
            stage,
            candidate: c
        };

        if (stage === 1) stage1Inputs.push(input);
        else if (stage === 2) stage2Inputs.push(input);
        else stage3Inputs.push(input);
    }));

    log.info({ stage1: stage1Inputs.length, stage2: stage2Inputs.length, stage3: stage3Inputs.length }, '🔀 [L2] Context Stage Distribution');

    // 🛑 B1 Fix: Pivot 兜底函数
    const processStageBatch = async (
        inputs: (ContextGeneratorInput & { candidate: DrillCandidate })[],
        stageNum: ContextStage
    ) => {
        if (inputs.length === 0) return;

        try {
            const p = getL2ContextBatchPrompt(inputs, stageNum);
            const { object: result, provider } = await AIService.generateObject({
                mode: 'fast', // Unified to Fast (User request: Context is short enough)
                schema: BatchDrillOutputSchema,
                system: p.system,
                prompt: p.user
            });

            result.items.forEach((drill: any, idx: number) => {
                if (idx < inputs.length) {
                    generatedDrills.push({ drill, candidate: inputs[idx].candidate, systemPrompt: p.system, userPrompt: p.user, provider });
                }
            });
        } catch (err: any) {
            // 🛑 Pivot Rule: LLM 失败时使用确定性兜底
            log.warn({ error: err.message, stage: stageNum, count: inputs.length }, '[L2] Stage LLM failed, using Pivot fallback');

            for (const input of inputs) {
                const fallbackDrill = buildPhraseFallbackDrill({
                    id: input.candidate.vocabId,
                    word: input.candidate.word,
                    definition_cn: input.candidate.definition_cn,
                    commonExample: input.candidate.commonExample,
                    collocations: input.candidate.collocations,
                    partOfSpeech: input.candidate.partOfSpeech // [New]
                }, 'CONTEXT');
                generatedDrills.push({ drill: fallbackDrill, candidate: input.candidate, systemPrompt: '', userPrompt: '', provider: 'fallback' });
            }
        }
    };

    // Generate per stage (parallel with Pivot protection)
    await Promise.all([
        processStageBatch(stage1Inputs, 1),
        processStageBatch(stage2Inputs, 2),
        processStageBatch(stage3Inputs, 3)
    ]);
}
