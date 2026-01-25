// Mock server-only to prevent error in test environment
vi.mock('server-only', () => { return {}; });

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WordSelectionService } from '../WordSelectionService';
import { prisma } from '@/lib/db';

// Mock DB
vi.mock('@/lib/db', () => ({
    prisma: {
        vocab: {
            findFirst: vi.fn(),
            findMany: vi.fn(),
        },
        userProgress: {
            findMany: vi.fn(),
        }
    }
}));

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
    })
}));

describe('WordSelectionService', () => {
    let service: WordSelectionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new WordSelectionService('user1');
    });

    describe('selectTargetWord', () => {
        it('should select valid target word', async () => {
            (prisma.userProgress.findMany as any).mockResolvedValue([{ vocabId: 1 }]);
            (prisma.vocab.findFirst as any).mockResolvedValue({ id: 2, word: 'target', scenarios: ['biz'] });

            const result = await service.selectTargetWord();

            expect(result?.word).toBe('target');
            expect(prisma.vocab.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: { notIn: [1] },
                        scenarios: { isEmpty: false }
                    })
                })
            );
        });

        it('should return null if no target found', async () => {
            (prisma.userProgress.findMany as any).mockResolvedValue([]);
            (prisma.vocab.findFirst as any).mockResolvedValue(null);
            const result = await service.selectTargetWord();
            expect(result).toBeNull();
        });
    });

    describe('selectContextWords', () => {
        it('should select context words matching scenario', async () => {
            const target = { id: 10, word: 'target', scenarios: ['sales'] } as any;

            // Mock learning progress (candidates)
            (prisma.userProgress.findMany as any).mockResolvedValue([
                { vocab: { id: 1, word: 'match1', scenarios: ['sales'] } },
                { vocab: { id: 2, word: 'match2', scenarios: ['sales', 'other'] } },
                { vocab: { id: 3, word: 'mismatch', scenarios: ['tech'] } },
            ]);

            const context = await service.selectContextWords(target, 5);

            expect(context).toHaveLength(2);
            expect(context.map(c => c.word)).toEqual(['match1', 'match2']);
        });

        it('should fallback to CEFR level if context words insufficient', async () => {
            const target = { id: 10, word: 'target', scenarios: ['sales'], cefrLevel: 'B2' } as any;

            // Scenario match only returns 0
            (prisma.userProgress.findMany as any).mockResolvedValue([]);

            // Fallback (same CEFR)
            (prisma.vocab.findMany as any).mockResolvedValue([
                { id: 20, word: 'fallback1', cefrLevel: 'B2' }
            ]);

            const context = await service.selectContextWords(target, 5);

            expect(context).toHaveLength(1);
            expect(context[0].word).toBe('fallback1');
            expect(prisma.vocab.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        cefrLevel: 'B2',
                        id: { not: 10 }
                    })
                })
            );
        });
    });
});
