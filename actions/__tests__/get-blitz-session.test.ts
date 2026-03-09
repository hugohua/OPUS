/**
 * Blitz Session V3 测试
 * 
 * 迁移后验证：OMPS 统一选词 + Phrase Mask 生成
 * Mock 策略：mock fetchOMPSCandidates（不测 OMPS 内部逻辑，已由 omps-core.test.ts 覆盖）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));

// [Mock Auth]
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

// [Mock OMPS]
vi.mock('@/lib/services/omps-core', () => ({
    fetchOMPSCandidates: vi.fn(),
    OMPS_ARENA_CONFIG: { rescueRatio: 0.3, reviewRatio: 0.5 },
}));

// [Mock DB - for collocations fetch]
vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    const mock = mockDeep();
    return { prisma: mock, db: mock };
});

import { auth } from '@/auth';
import { fetchOMPSCandidates } from '@/lib/services/omps-core';
import { prisma } from '@/lib/db';
import { getBlitzSession } from '../get-blitz-session';
import type { OMPSCandidate } from '@/lib/services/omps-core';

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockOMPS = fetchOMPSCandidates as unknown as ReturnType<typeof vi.fn>;
const mockPrisma = prisma as any;

// Test data factory
const createCandidate = (
    vocabId: number,
    source: 'rescue' | 'review' | 'new' = 'review'
): OMPSCandidate => ({
    vocabId,
    word: `word-${vocabId}`,
    definition_cn: `释义-${vocabId}`,
    word_family: {},
    priority_level: 2,
    frequency_score: 100 - vocabId,
    commonExample: null,
    type: source === 'new' ? 'NEW' : 'REVIEW',
    source,
});

describe('getBlitzSession (OMPS V3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: 'u1' } });
        // collocations 默认空
        mockPrisma.vocab.findMany.mockResolvedValue([]);
    });

    it('应返回 OMPS 候选词映射为 Blitz 格式', async () => {
        const candidates = Array.from({ length: 20 }, (_, i) =>
            createCandidate(i + 1, i < 6 ? 'rescue' : i < 16 ? 'review' : 'new')
        );
        mockOMPS.mockResolvedValue(candidates);

        const result = await getBlitzSession();

        expect(result.status).toBe('success');
        const items = result.data?.items || [];
        expect(items).toHaveLength(20);

        // 验证每个 item 都有正确的结构
        for (const item of items) {
            expect(item).toHaveProperty('vocabId');
            expect(item).toHaveProperty('word');
            expect(item).toHaveProperty('context');
            expect(item.context).toHaveProperty('maskedText');
            expect(item.context).toHaveProperty('translation');
            expect(item.track).toBe('VISUAL');
        }
    });

    it('应使用 OMPS_ARENA_CONFIG 调用 OMPS', async () => {
        mockOMPS.mockResolvedValue([createCandidate(1)]);

        await getBlitzSession();

        expect(mockOMPS).toHaveBeenCalledWith(
            'u1',
            20,
            { rescueRatio: 0.3, reviewRatio: 0.5 },
            [],
            'BLITZ'
        );
    });

    it('空候选集应返回空 items', async () => {
        mockOMPS.mockResolvedValue([]);

        const result = await getBlitzSession();

        expect(result.status).toBe('success');
        expect(result.data?.items).toHaveLength(0);
    });

    it('Phrase Mask: 词汇出现在 collocation 中时应被遮罩', async () => {
        const candidate = createCandidate(1);
        candidate.word = 'budget';
        mockOMPS.mockResolvedValue([candidate]);

        // Mock collocations
        mockPrisma.vocab.findMany.mockResolvedValue([{
            id: 1,
            collocations: [{ text: 'annual budget report', trans: '年度预算报告' }]
        }]);

        const result = await getBlitzSession();
        const item = result.data?.items?.[0];

        expect(item?.context.maskedText).toContain('_______');
        expect(item?.context.maskedText).not.toContain('budget');
    });

    it('无 collocations 时应 fallback 到单词本身', async () => {
        const candidate = createCandidate(1);
        candidate.word = 'approve';
        candidate.definition_cn = '批准';
        mockOMPS.mockResolvedValue([candidate]);

        const result = await getBlitzSession();
        const item = result.data?.items?.[0];

        expect(item?.context.translation).toBe('批准');
        expect(item?.context.text).toBe('approve');
    });
});
