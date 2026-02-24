import { AIService } from '@/lib/ai/core';
import { DrillCandidate, BatchDrillOutputSchema } from '../types';
import { logger as log } from '@/lib/logger';
import { VocabEntity, CollocationItem } from '@/types/vocab';
import { buildSyntaxInput, buildPhraseInput, buildBlitzInputWithTraps } from '@/lib/generators/input-builders';
import { getL0SyntaxBatchPrompt } from '@/lib/generators/l0/syntax';
import { getL0BlitzBatchPrompt } from '@/lib/generators/l0/blitz';
import { getL0PhraseBatchPrompt } from '@/lib/generators/l0/phrase';
import { buildPhraseDrill } from '@/lib/templates/phrase-drill';
import { buildPhraseFallbackDrill } from '@/lib/templates/phrase-fallback';
import { getL1ChunkingBatchPrompt } from '@/lib/generators/l1/chunking';
import { buildChunkingDrillFallback } from '@/lib/templates/deterministic-drill';
import { getL2NuanceBatchPrompt } from '@/lib/generators/l2/nuance';

// ======= 🛡️ PIVOT (FAIL-SAFE) HELPER ======= //
const applyDeterministicFallback = (candidate: DrillCandidate, mode: string) => {
    log.warn({ word: candidate.word, mode }, '⚠️ Triggered Deterministic Fallback in Basic Handler');
    if (mode === 'CHUNKING') {
        return buildChunkingDrillFallback(candidate as any);
    }
    return buildPhraseFallbackDrill(candidate as any, mode as any);
};

// ======= 🎛️ LLM TIER CONFIG ======= //
const LLM_TIER_CONFIG = {
    SYNTAX: 'fast',
    BLITZ: 'fast',
    PHRASE: 'smart',   // Phrase 需要更多语境理解
    CHUNKING: 'fast',
    NUANCE: 'fast'     // Nuance 目前依赖短对话，可使用快模型
} as const;

// ======= PROCESSING QUEUES ======= //

export async function processSyntaxQueue(
    userId: string,
    syntaxGroup: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (syntaxGroup.length === 0) return;

    try {
        const inputs = await Promise.all(syntaxGroup.map(c => buildSyntaxInput(userId, c as VocabEntity)));
        const p = getL0SyntaxBatchPrompt(inputs);

        const { object: result, provider } = await AIService.generateObject({
            mode: LLM_TIER_CONFIG.SYNTAX,
            schema: BatchDrillOutputSchema,
            system: p.system,
            prompt: p.user
        });

        result.items.forEach((drill: any, idx: number) => {
            if (idx < syntaxGroup.length) {
                generatedDrills.push({ drill, candidate: syntaxGroup[idx], systemPrompt: p.system, userPrompt: p.user, provider });
            }
        });
    } catch (err: any) {
        log.error({ error: err.message }, 'Failed to process Syntax group, recovering via Phrase Pivot');
        syntaxGroup.forEach(c => {
            generatedDrills.push({
                drill: applyDeterministicFallback(c, 'SYNTAX'),
                candidate: c,
                systemPrompt: 'PIVOT', userPrompt: 'PIVOT', provider: 'fallback'
            });
        });
    }
}

export async function processBlitzQueue(
    blitzGroup: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (blitzGroup.length === 0) return;

    try {
        const inputs = await Promise.all(blitzGroup.map(c => buildBlitzInputWithTraps(c as VocabEntity)));
        const p = getL0BlitzBatchPrompt(inputs);

        const { object: result, provider } = await AIService.generateObject({
            mode: LLM_TIER_CONFIG.BLITZ,
            schema: BatchDrillOutputSchema,
            system: p.system,
            prompt: p.user
        });

        result.items.forEach((drill: any, idx: number) => {
            if (idx < blitzGroup.length) {
                generatedDrills.push({ drill, candidate: blitzGroup[idx], systemPrompt: p.system, userPrompt: p.user, provider });
            }
        });
    } catch (err: any) {
        log.error({ error: err.message }, 'Failed to process Blitz group, recovering via Phrase Pivot');
        blitzGroup.forEach(c => {
            generatedDrills.push({
                drill: applyDeterministicFallback(c, 'BLITZ'),
                candidate: c,
                systemPrompt: 'PIVOT', userPrompt: 'PIVOT', provider: 'fallback'
            });
        });
    }
}

export async function processPhraseQueue(
    phraseGroup: DrillCandidate[],
    generatedDrills: any[],
    mode: string
): Promise<void> {
    if (phraseGroup.length === 0) return;

    const llmCandidates: DrillCandidate[] = [];

    // 1. Try DB First (Deterministic)
    for (const c of phraseGroup) {
        const vocabLike = {
            id: c.vocabId, word: c.word, definition_cn: c.definition_cn,
            phoneticUs: c.phoneticUs, partOfSpeech: c.partOfSpeech,
            collocations: c.collocations, commonExample: c.commonExample, etymology: c.etymology
        } as any;

        const dbDrill = buildPhraseDrill(vocabLike);

        if (dbDrill) {
            generatedDrills.push({
                drill: buildPhraseFallbackDrill(c as any, mode as any),
                candidate: c,
                systemPrompt: 'DB_FIRST', userPrompt: 'DB_FIRST', provider: 'db_collocation'
            });
        } else {
            llmCandidates.push(c);
        }
    }

    if (llmCandidates.length === 0) return;

    // 2. LLM Fallback
    try {
        log.info({ count: llmCandidates.length }, '⚠️ Phrase DB miss, falling back to LLM');
        const inputs = llmCandidates.map(c => buildPhraseInput(c as VocabEntity));
        const p = getL0PhraseBatchPrompt(inputs);

        const { object: result, provider } = await AIService.generateObject({
            mode: LLM_TIER_CONFIG.PHRASE,
            schema: BatchDrillOutputSchema,
            system: p.system,
            prompt: p.user
        });

        result.items.forEach((drill: any, idx: number) => {
            if (idx < llmCandidates.length) {
                generatedDrills.push({ drill, candidate: llmCandidates[idx], systemPrompt: p.system, userPrompt: p.user, provider });
            }
        });
    } catch (err: any) {
        log.error({ error: err.message }, 'Failed to process Phrase group LLM, strict aborting to standard template');
        llmCandidates.forEach(c => {
            generatedDrills.push({
                drill: applyDeterministicFallback(c, 'PHRASE'),
                candidate: c,
                systemPrompt: 'PIVOT', userPrompt: 'PIVOT', provider: 'fallback'
            });
        });
    }
}

export async function processChunkingQueue(
    chunkingGroup: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (chunkingGroup.length === 0) return;

    try {
        const inputs = chunkingGroup.map(c => ({
            sentence: c.commonExample || `The ${c.word} is essential for success.`,
            targetWord: c.word
        }));
        const p = getL1ChunkingBatchPrompt(inputs);

        const { object: result, provider } = await AIService.generateObject({
            mode: LLM_TIER_CONFIG.CHUNKING,
            schema: BatchDrillOutputSchema,
            system: p.system,
            prompt: p.user
        });

        result.items.forEach((drill: any, idx: number) => {
            if (idx < chunkingGroup.length) {
                generatedDrills.push({ drill, candidate: chunkingGroup[idx], systemPrompt: p.system, userPrompt: p.user, provider });
            }
        });
    } catch (err: any) {
        log.error({ error: err.message }, 'Failed to process Chunking group, recovering via Chunking Pivot');
        chunkingGroup.forEach(c => {
            generatedDrills.push({
                drill: applyDeterministicFallback(c, 'CHUNKING'),
                candidate: c,
                systemPrompt: 'PIVOT', userPrompt: 'PIVOT', provider: 'fallback'
            });
        });
    }
}

export async function processNuanceQueue(
    nuanceGroup: DrillCandidate[],
    generatedDrills: any[]
): Promise<void> {
    if (nuanceGroup.length === 0) return;

    try {
        const inputs = nuanceGroup.map(c => ({
            targetWord: c.word,
            meaning: c.definition_cn || '',
            synonyms: c.synonyms || [],
            scenario: c.scenario || 'business communication'
        }));
        const p = getL2NuanceBatchPrompt(inputs);

        const { object: result, provider } = await AIService.generateObject({
            mode: LLM_TIER_CONFIG.NUANCE,
            schema: BatchDrillOutputSchema,
            system: p.system,
            prompt: p.user
        });

        result.items.forEach((drill: any, idx: number) => {
            if (idx < nuanceGroup.length) {
                generatedDrills.push({ drill, candidate: nuanceGroup[idx], systemPrompt: p.system, userPrompt: p.user, provider });
            }
        });
    } catch (err: any) {
        log.error({ error: err.message }, 'Failed to process Nuance group, recovering via Phrase Pivot');
        nuanceGroup.forEach(c => {
            generatedDrills.push({
                drill: applyDeterministicFallback(c, 'NUANCE'),
                candidate: c,
                systemPrompt: 'PIVOT', userPrompt: 'PIVOT', provider: 'fallback'
            });
        });
    }
}
