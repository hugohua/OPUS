import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    processSyntaxQueue,
    processBlitzQueue,
    processPhraseQueue,
    processChunkingQueue,
    processNuanceQueue
} from '../basic-handler';
import { AIService } from '@/lib/ai/core';

// Mock dependencies
vi.mock('@/lib/ai/core', () => ({
    AIService: {
        generateObject: vi.fn()
    }
}));

vi.mock('@/lib/generators/input-builders', () => ({
    buildSyntaxInput: vi.fn().mockResolvedValue({ targetWord: 'test' }),
    buildPhraseInput: vi.fn(),
    buildBlitzInputWithTraps: vi.fn().mockResolvedValue({ targetWord: 'test' }),
}));

vi.mock('@/lib/templates/phrase-drill', () => ({
    buildPhraseDrill: vi.fn()
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn()
        })
    }
}));

describe('Basic Handlers', () => {
    let generatedDrills: any[];

    beforeEach(() => {
        generatedDrills = [];
        vi.clearAllMocks();

        // Default Mock Return
        (AIService.generateObject as any).mockResolvedValue({
            object: {
                items: [
                    {
                        meta: { format: 'chat', target_word: 'test_return' },
                        segments: []
                    }
                ]
            },
            provider: 'mockProvider'
        });
    });

    const mockCandidate = {
        vocabId: 1,
        word: 'test',
        definition_cn: '测试',
    } as any;

    describe('processSyntaxQueue', () => {
        it('should correctly call AIService and append to generatedDrills', async () => {
            const userId = 'user_123';
            await processSyntaxQueue(userId, [mockCandidate], generatedDrills);

            expect(AIService.generateObject).toHaveBeenCalled();
            expect(generatedDrills.length).toBe(1);
            expect(generatedDrills[0].candidate.word).toBe('test');
            expect(generatedDrills[0].drill.meta.target_word).toBe('test_return');
        });

        it('should do nothing if queue is empty', async () => {
            await processSyntaxQueue('user_123', [], generatedDrills);
            expect(AIService.generateObject).not.toHaveBeenCalled();
            expect(generatedDrills.length).toBe(0);
        });
    });

    describe('processBlitzQueue', () => {
        it('should correctly process blitz drills', async () => {
            await processBlitzQueue([mockCandidate], generatedDrills);
            expect(AIService.generateObject).toHaveBeenCalled();
            expect(generatedDrills.length).toBe(1);
        });
    });

    describe('processChunkingQueue', () => {
        it('should process chunking requests correctly', async () => {
            await processChunkingQueue([mockCandidate], generatedDrills);
            expect(AIService.generateObject).toHaveBeenCalled();
            expect(generatedDrills.length).toBe(1);
        });
    });

    describe('processNuanceQueue', () => {
        it('should process nuance requests properly', async () => {
            await processNuanceQueue([mockCandidate], generatedDrills);
            expect(AIService.generateObject).toHaveBeenCalled();
            expect(generatedDrills.length).toBe(1);
        });
    });

});
