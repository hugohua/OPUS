import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// --- Mocks ---
vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    const mock = mockDeep<PrismaClient>();
    return { prisma: mock, db: mock };
});
vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));
vi.mock('@/lib/ai/core', () => ({
    AIService: {
        generateObject: vi.fn(),
    },
}));

import { auth } from '@/auth';
import { AIService } from '@/lib/ai/core';
import { fetchMiniLesson } from '../mini-lesson';

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockAI = AIService.generateObject as unknown as ReturnType<typeof vi.fn>;

// --- 测试数据 ---
const TEST_USER_ID = 'test_user_mini_001';
const TEST_SEED_ID = 'seed_mini_001';
const TEST_GRAMMAR_NODE_ID = 'gn_verb_tense';

const MOCK_SEED = {
    grammarNodeId: TEST_GRAMMAR_NODE_ID,
    sentence: 'The company has _____ significant growth since 2020.',
    targetAnswer: 'experienced',
    rationale: '现在完成时需要用过去分词形式。',
};

const MOCK_GRAMMAR_NODE = {
    name: '现在完成时',
    description: '表示过去发生的动作对现在产生影响，常与 since/for 连用。',
};

const MOCK_AI_RESPONSE = {
    object: {
        errorAnalysis: '用户选了一般过去式，忽略了 since 2020 这个时间标志。',
        grammarOverview: '现在完成时用 have/has + 过去分词，强调对现在的影响。',
        exampleSentences: ['She has worked here for 5 years.', 'We have completed the report.'],
    },
    provider: 'test-provider',
};

describe('fetchMiniLesson', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: TEST_USER_ID } });
    });

    // === Happy Path ===

    it('masteryScore < 0.3 → 返回 mini-lesson', async () => {
        mockPrisma.questionSeed.findUnique.mockResolvedValue(MOCK_SEED as any);
        mockPrisma.userGrammarProficiency.findUnique.mockResolvedValue({
            masteryScore: 0.2, exposureCount: 10, correctCount: 3,
        } as any);
        mockPrisma.grammarNode.findUnique.mockResolvedValue(MOCK_GRAMMAR_NODE as any);
        mockAI.mockResolvedValue(MOCK_AI_RESPONSE);

        const result = await fetchMiniLesson({
            questionSeedId: TEST_SEED_ID,
            selectedOption: 'experienced',
        });

        expect(result.mode).toBe('mini-lesson');
        if (result.mode === 'mini-lesson') {
            expect(result.miniLesson.grammarNodeName).toBe('现在完成时');
            expect(result.miniLesson.errorAnalysis).toBeTruthy();
            expect(result.miniLesson.exampleSentences.length).toBeGreaterThanOrEqual(1);
        }
    });

    // === Early Return 链 ===

    it('未认证 → 返回 rationale', async () => {
        mockAuth.mockResolvedValue(null);

        const result = await fetchMiniLesson({
            questionSeedId: TEST_SEED_ID,
            selectedOption: 'test',
        });

        expect(result.mode).toBe('rationale');
    });

    it('grammarNodeId 为空 → 返回 rationale (纯词汇题)', async () => {
        mockPrisma.questionSeed.findUnique.mockResolvedValue({
            ...MOCK_SEED,
            grammarNodeId: null,
        } as any);

        const result = await fetchMiniLesson({
            questionSeedId: TEST_SEED_ID,
            selectedOption: 'test',
        });

        expect(result.mode).toBe('rationale');
    });

    it('masteryScore >= 0.3 → 返回 rationale (掌握度足够)', async () => {
        mockPrisma.questionSeed.findUnique.mockResolvedValue(MOCK_SEED as any);
        mockPrisma.userGrammarProficiency.findUnique.mockResolvedValue({
            masteryScore: 0.5,
        } as any);

        const result = await fetchMiniLesson({
            questionSeedId: TEST_SEED_ID,
            selectedOption: 'test',
        });

        expect(result.mode).toBe('rationale');
        // 确保没有查 GrammarNode（提前返回）
        expect(mockPrisma.grammarNode.findUnique).not.toHaveBeenCalled();
    });

    it('首次遇到语法点 (proficiency 不存在) → 返回 rationale (冷启动 0.5)', async () => {
        mockPrisma.questionSeed.findUnique.mockResolvedValue(MOCK_SEED as any);
        mockPrisma.userGrammarProficiency.findUnique.mockResolvedValue(null);

        const result = await fetchMiniLesson({
            questionSeedId: TEST_SEED_ID,
            selectedOption: 'test',
        });

        expect(result.mode).toBe('rationale');
    });

    // === Fail-Safe ===

    it('LLM 生成失败 → 降级为 rationale (Fail-Safe)', async () => {
        mockPrisma.questionSeed.findUnique.mockResolvedValue(MOCK_SEED as any);
        mockPrisma.userGrammarProficiency.findUnique.mockResolvedValue({
            masteryScore: 0.1,
        } as any);
        mockPrisma.grammarNode.findUnique.mockResolvedValue(MOCK_GRAMMAR_NODE as any);
        mockAI.mockRejectedValue(new Error('LLM timeout'));

        const result = await fetchMiniLesson({
            questionSeedId: TEST_SEED_ID,
            selectedOption: 'test',
        });

        expect(result.mode).toBe('rationale');
    });

    it('数据库查询失败 → 降级为 rationale (Fail-Safe)', async () => {
        mockPrisma.questionSeed.findUnique.mockRejectedValue(new Error('DB connection lost'));

        const result = await fetchMiniLesson({
            questionSeedId: TEST_SEED_ID,
            selectedOption: 'test',
        });

        expect(result.mode).toBe('rationale');
    });
});
