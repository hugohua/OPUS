import { AIService } from '@/lib/ai/core';
import { DrillCandidate, BatchDrillOutputSchema } from '../types';
import { logger as log } from '@/lib/logger';
import { getL1AudioScriptPrompt, AudioScriptInput } from '@/lib/generators/l1/audio-script';

export async function processAudioQueue(
    audioGroup: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (audioGroup.length === 0) return;

    const mapToAudioInput = (c: DrillCandidate): AudioScriptInput => {
        const stability = c.reviewData?.stability || 0;
        const difficulty = c.reviewData?.difficulty || 5;

        return {
            word: c.word,
            stability,
            difficulty,
            confusion_audio: c.confusion_audio?.slice(0, 2) || []
        };
    };

    const inputs = audioGroup.map(mapToAudioInput);
    const p = getL1AudioScriptPrompt(inputs);

    const { object: result, provider } = await AIService.generateObject({
        mode: 'fast',
        schema: BatchDrillOutputSchema,
        system: p.system,
        prompt: p.user
    });

    result.items.forEach((drill: any, idx: number) => {
        if (idx < audioGroup.length) {
            generatedDrills.push({
                drill,
                candidate: audioGroup[idx],
                systemPrompt: p.system,
                userPrompt: p.user,
                provider: provider
            });
        }
    });
}
