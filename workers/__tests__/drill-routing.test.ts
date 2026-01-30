
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processDrillJob } from '../drill-processor';
import { Job } from 'bullmq';

// --- Mocks ---

// Mock Logger
vi.mock('@/lib/logger', () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        }),
    },
}));

// Mock Inventory
vi.mock('@/lib/inventory', () => ({
    inventory: {
        getInventoryCounts: vi.fn().mockResolvedValue({}),
        pushDrill: vi.fn().mockResolvedValue(true),
    },
}));

// Mock DB (not used if we stick to Plan: generate-scheduled)
vi.mock('@/lib/db', () => ({
    db: {
        vocab: {
            findMany: vi.fn(),
        },
    },
}));

// Mock OMPS Core (Dynamic Import Target)
vi.mock('@/lib/services/omps-core', () => ({
    fetchOMPSCandidates: vi.fn(),
}));

// Mock Generators
vi.mock('@/lib/generators/l0/syntax', () => ({
    getL0SyntaxBatchPrompt: vi.fn().mockReturnValue({ system: 'SYNTAX_SYS', user: 'SYNTAX_USER' }),
}));

vi.mock('@/lib/generators/l0/blitz', () => ({
    getL0BlitzBatchPrompt: vi.fn().mockReturnValue({ system: 'BLITZ_SYS', user: 'BLITZ_USER' }),
}));

vi.mock('@/lib/generators/l0/phrase', () => ({
    getL0PhraseBatchPrompt: vi.fn().mockReturnValue({ system: 'PHRASE_SYS', user: 'PHRASE_USER' }),
}));

// Mock LLM Failover
vi.mock('../llm-failover', () => ({
    generateWithFailover: vi.fn().mockResolvedValue({ text: 'MOCKED_LLM_OUTPUT', provider: 'mock-gpt' }),
}));

// Mock AI Utils
vi.mock('@/lib/ai/utils', () => ({
    safeParse: vi.fn().mockImplementation((text, schema) => {
        // Return a dummy matching structure
        return {
            drills: [
                {
                    meta: { format: 'chat', target_word: 'mock' },
                    segments: [],
                }
            ]
        };
    }),
}));

// Mock Context Selector
vi.mock('@/lib/ai/context-selector', () => ({
    ContextSelector: {
        select: vi.fn().mockResolvedValue([]),
    },
}));

// --- Tests ---

describe('Drill Processor Routing', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createJob = (mode: string = 'SYNTAX') => ({
        name: 'generate-scheduled',
        data: {
            userId: 'test-user',
            mode,
            correlationId: 'test-corr',
            forceLimit: 1
        }
    } as unknown as Job);

    it('Scenario 1: New Word -> Use Syntax Generator', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { getL0SyntaxBatchPrompt } = await import('@/lib/generators/l0/syntax');
        const { getL0BlitzBatchPrompt } = await import('@/lib/generators/l0/blitz');

        // Mock OMPS candidate: Type NEW
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([
            {
                vocabId: 1,
                word: 'apple',
                definition_cn: '苹果',
                word_family: {},
                priority_level: 1,
                frequency_score: 99,
                commonExample: null,
                type: 'NEW',
                reviewData: null
            } as any
        ]);

        await processDrillJob(createJob('SYNTAX'));

        // Expect Syntax to be called
        expect(getL0SyntaxBatchPrompt).toHaveBeenCalled();
        // Expect Blitz NOT to be called
        expect(getL0BlitzBatchPrompt).not.toHaveBeenCalled();
    });

    it('Scenario 2: Low Stability Review (<7) -> Use Syntax Generator (POS Trap)', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { getL0SyntaxBatchPrompt } = await import('@/lib/generators/l0/syntax');

        // Mock OMPS candidate: Review + Stability 3
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([
            {
                vocabId: 2,
                word: 'run',
                definition_cn: '跑',
                type: 'REVIEW',
                reviewData: { stability: 3, state: 2 } // Review, low stability
            } as any
        ]);

        await processDrillJob(createJob('SYNTAX'));

        expect(getL0SyntaxBatchPrompt).toHaveBeenCalled();
    });

    it('Scenario 3: High Stability Review (>=7) -> Use Blitz Generator', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { getL0SyntaxBatchPrompt } = await import('@/lib/generators/l0/syntax');
        const { getL0BlitzBatchPrompt } = await import('@/lib/generators/l0/blitz');

        // Mock OMPS candidate: Review + Stability 10
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([
            {
                vocabId: 3,
                word: 'negotiate',
                definition_cn: '谈判',
                collocations: ['deal'],
                type: 'REVIEW',
                reviewData: { stability: 10, state: 2 }
            } as any
        ]);

        await processDrillJob(createJob('SYNTAX'));

        expect(getL0BlitzBatchPrompt).toHaveBeenCalled();
        expect(getL0SyntaxBatchPrompt).not.toHaveBeenCalled();
    });

    it('Scenario 4: Mixed Batch -> Use Both Generators', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { getL0SyntaxBatchPrompt } = await import('@/lib/generators/l0/syntax');
        const { getL0BlitzBatchPrompt } = await import('@/lib/generators/l0/blitz');

        // Mock OMPS candidate: 1 New, 1 Master
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([
            { vocabId: 1, word: 'new', type: 'NEW' } as any,
            { vocabId: 2, word: 'master', type: 'REVIEW', reviewData: { stability: 20 }, collocations: ['test'] } as any
        ]);

        await processDrillJob({
            name: 'generate-scheduled',
            data: { userId: 'u', mode: 'SYNTAX', forceLimit: 2 }
        } as any);

        expect(getL0SyntaxBatchPrompt).toHaveBeenCalled(); // 1 called
        expect(getL0BlitzBatchPrompt).toHaveBeenCalled(); // 1 called
    });

});
