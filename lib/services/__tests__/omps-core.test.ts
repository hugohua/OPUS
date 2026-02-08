/**
 * OMPS Core 完整测试套件
 * 
 * 测试用例结构：
 * - Suite A: Macro Scheduler (70/30 配比)
 * - Suite B: Micro Sampler (分层采样)
 * - Suite C: Edge Cases (边界情况)
 * - Suite D: Integration (集成场景)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fetchOMPSCandidates, getStratifiedNewWords, fetchNewBucket, OMPSCandidate } from '../omps-core';

// ============================================
// Mock 配置
// ============================================

const MOCK_USER_ID = 'cm66x5x5x000008l4am90956r';

vi.mock('@/lib/db', () => {
    const mockPrisma = {
        userProgress: {
            findMany: vi.fn()
        },
        vocab: {
            findMany: vi.fn()
        }
    };
    return {
        db: mockPrisma,
        prisma: mockPrisma
    };
});

import { db as prisma } from '@/lib/db';

// 模拟 ioredis
vi.mock('@/lib/queue/connection', () => {
    const mockRedis = {
        keys: vi.fn(),
        pipeline: vi.fn(),
    };
    return {
        redis: mockRedis
    };
});

import { redis } from '@/lib/queue/connection';

// ============================================
// 测试数据工厂
// ============================================

const createVocab = (id: number, options: {
    word?: string;
    level?: number;
    core?: boolean;
    pos?: string;
} = {}) => ({
    id,
    word: options.word || `word-${id}`,
    definition_cn: `定义-${id}`,
    abceed_level: options.level ?? 5,
    is_toeic_core: options.core ?? false,
    frequency_score: 100 - id,
    partOfSpeech: options.pos || 'n',
    scenarios: ['business'],
    word_family: {},
    commonExample: `Example for ${id}`,
    collocations: {}
});

const createProgress = (vocabId: number, due: Date, status: string = 'REVIEW') => ({
    id: `prog-${vocabId}`,
    userId: MOCK_USER_ID,
    vocabId,
    status,
    next_review_at: due,
    vocab: createVocab(vocabId)
});

// ============================================
// Suite A: Macro Scheduler (70/30 配比)
// ============================================

describe('Suite A: Macro Scheduler', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('A1: 标准债务 - 7复习 + 3新词 (70/30)', async () => {
        // 准备：7 个到期复习词
        const reviews = Array.from({ length: 7 }, (_, i) =>
            createProgress(i + 1, new Date(Date.now() - 1000 * i))
        );
        (prisma.userProgress.findMany as any).mockResolvedValue(reviews);

        // 准备：新词池
        let newId = 100;
        (prisma.vocab.findMany as any).mockImplementation(({ take }: any) =>
            Promise.resolve(Array.from({ length: take }, () => createVocab(newId++)))
        );

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10);

        const reviewCount = result.filter(c => c.type === 'REVIEW').length;
        const newCount = result.filter(c => c.type === 'NEW').length;

        expect(result).toHaveLength(10);
        expect(reviewCount).toBe(7);
        expect(newCount).toBe(3);
    });

    it('A2: 低债务溢出 - 2复习 + 8新词 (Spillover)', async () => {
        // 准备：只有 2 个到期复习词
        const reviews = [
            createProgress(1, new Date()),
            createProgress(2, new Date())
        ];
        (prisma.userProgress.findMany as any).mockResolvedValue(reviews);

        let newId = 100;
        (prisma.vocab.findMany as any).mockImplementation(({ take }: any) =>
            Promise.resolve(Array.from({ length: take }, () => createVocab(newId++)))
        );

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10);

        expect(result.filter(c => c.type === 'REVIEW')).toHaveLength(2);
        expect(result.filter(c => c.type === 'NEW')).toHaveLength(8);
    });

    it('A3: 零债务 - 全新词', async () => {
        (prisma.userProgress.findMany as any).mockResolvedValue([]);

        let newId = 1;
        (prisma.vocab.findMany as any).mockImplementation(({ take }: any) =>
            Promise.resolve(Array.from({ length: take }, () => createVocab(newId++)))
        );

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10);

        expect(result.filter(c => c.type === 'REVIEW')).toHaveLength(0);
        expect(result.filter(c => c.type === 'NEW')).toHaveLength(10);
    });

    it('A4: 复习词超额 - take参数限制', async () => {
        // 这个测试验证 DB 查询时 take 参数被正确设置
        // Mock 实现会尊重 take 参数
        (prisma.userProgress.findMany as any).mockImplementation(({ take }: any) => {
            // 模拟 DB 的 take 行为
            const all = Array.from({ length: 15 }, (_, i) =>
                createProgress(i + 1, new Date())
            );
            return Promise.resolve(all.slice(0, take));
        });

        (prisma.vocab.findMany as any).mockResolvedValue([]);

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10);

        // 70% of 10 = 7，所以最多取 7 个复习词
        expect(result.filter(c => c.type === 'REVIEW').length).toBeLessThanOrEqual(7);
    });

});

// ============================================
// Suite B: Micro Sampler (分层采样)
// ============================================

describe('Suite B: Micro Sampler', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.userProgress.findMany as any).mockResolvedValue([]);
    });

    it('B1: 10个新词配比请求验证 (2简单 + 6核心 + 2困难)', async () => {
        const calls: any[] = [];
        (prisma.vocab.findMany as any).mockImplementation((args: any) => {
            calls.push(args);
            return Promise.resolve([]);
        });

        await fetchOMPSCandidates(MOCK_USER_ID, 10);

        // 验证调用参数
        const simpleCalls = calls.filter(c => c.where?.abceed_level?.lte === 3);
        const hardCalls = calls.filter(c => c.where?.abceed_level?.gte === 8);
        const coreCalls = calls.filter(c => c.where?.OR);

        expect(simpleCalls.length).toBeGreaterThan(0);
        expect(hardCalls.length).toBeGreaterThan(0);
        expect(coreCalls.length).toBeGreaterThan(0);

        // 验证 take 参数
        expect(simpleCalls[0].take).toBe(2);
        expect(hardCalls[0].take).toBe(2);
        expect(coreCalls[0].take).toBe(6);
    });

    it('B2: 小数量不分层 - 直接取核心词', async () => {
        (prisma.vocab.findMany as any).mockResolvedValue([createVocab(1, { core: true })]);

        const result = await getStratifiedNewWords(MOCK_USER_ID, 1, []);

        expect(result).toHaveLength(1);
    });

    it('B3: 分桶充足 - 按比例返回', async () => {
        // 每个桶返回足够的词
        (prisma.vocab.findMany as any).mockImplementation(({ where, take }: any) => {
            let level = 5;
            if (where?.abceed_level?.lte === 3) level = 2;
            if (where?.abceed_level?.gte === 8) level = 9;
            return Promise.resolve(
                Array.from({ length: take }, (_, i) => createVocab(level * 100 + i, { level }))
            );
        });

        const result = await getStratifiedNewWords(MOCK_USER_ID, 10, []);

        const simple = result.filter(c => c.vocabId >= 200 && c.vocabId < 300);
        const hard = result.filter(c => c.vocabId >= 900);

        expect(simple).toHaveLength(2);
        expect(hard).toHaveLength(2);
    });

    it('B4: Simple桶空 - Core补位', async () => {
        let callCount = 0;
        (prisma.vocab.findMany as any).mockImplementation(({ where, take }: any) => {
            callCount++;
            // Simple桶返回空
            if (where?.abceed_level?.lte === 3) {
                return Promise.resolve([]);
            }
            // Core桶返回足够多
            return Promise.resolve(
                Array.from({ length: take }, (_, i) => createVocab(500 + callCount * 10 + i, { level: 5 }))
            );
        });

        const result = await getStratifiedNewWords(MOCK_USER_ID, 10, []);

        expect(result.length).toBe(10);
    });

});

// ============================================
// Suite C: Edge Cases (边界情况)
// ============================================

describe('Suite C: Edge Cases', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('C1: 空数据库 - 返回空数组', async () => {
        (prisma.userProgress.findMany as any).mockResolvedValue([]);
        (prisma.vocab.findMany as any).mockResolvedValue([]);

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10);

        expect(result).toEqual([]);
    });

    it('C2: limit=1 - 单词返回', async () => {
        (prisma.userProgress.findMany as any).mockResolvedValue([]);
        (prisma.vocab.findMany as any).mockResolvedValue([createVocab(1)]);

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 1);

        expect(result).toHaveLength(1);
    });

    it('C3: limit=0 - 返回空', async () => {
        const result = await fetchOMPSCandidates(MOCK_USER_ID, 0);

        expect(result).toEqual([]);
    });

    it('C4: excludeIds 生效', async () => {
        const calls: any[] = [];
        (prisma.userProgress.findMany as any).mockImplementation((args: any) => {
            calls.push(args);
            return Promise.resolve([]);
        });
        (prisma.vocab.findMany as any).mockResolvedValue([]);

        await fetchOMPSCandidates(MOCK_USER_ID, 10, {}, [1, 2, 3]);

        // 验证 excludeIds 被传递到查询
        expect(calls[0].where.vocab.id.notIn).toEqual([1, 2, 3]);
    });

    it('C5: posFilter 生效', async () => {
        const calls: any[] = [];
        (prisma.userProgress.findMany as any).mockResolvedValue([]);
        (prisma.vocab.findMany as any).mockImplementation((args: any) => {
            calls.push(args);
            return Promise.resolve([]);
        });

        await fetchOMPSCandidates(MOCK_USER_ID, 10, { posFilter: ['v', 'n'] });

        // 验证 posFilter 被传递到新词查询
        const newWordCall = calls.find(c => c.where?.partOfSpeech);
        expect(newWordCall?.where?.partOfSpeech?.in).toEqual(['v', 'n']);
    });

});

// ============================================
// Suite D: Integration (集成场景)
// ============================================

describe('Suite D: Integration', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('D1: 模拟真实用户场景 - 混合复习与新词', async () => {
        // 用户有 3 个到期复习词
        const reviews = [
            createProgress(1, new Date(Date.now() - 86400000)), // 1天前到期
            createProgress(2, new Date(Date.now() - 3600000)),  // 1小时前
            createProgress(3, new Date()),                       // 刚到期
        ];
        (prisma.userProgress.findMany as any).mockResolvedValue(reviews);

        // 词库有各难度词汇
        (prisma.vocab.findMany as any).mockImplementation(({ where, take }: any) => {
            if (where?.abceed_level?.lte === 3) {
                return Promise.resolve([createVocab(101, { level: 2, word: 'easy' })]);
            }
            if (where?.abceed_level?.gte === 8) {
                return Promise.resolve([createVocab(901, { level: 9, word: 'hard' })]);
            }
            // Core
            return Promise.resolve(
                Array.from({ length: take }, (_, i) =>
                    createVocab(500 + i, { level: 5, core: true, word: `core-${i}` })
                )
            );
        });

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10);

        // 验证混合
        expect(result.some(c => c.type === 'REVIEW')).toBe(true);
        expect(result.some(c => c.type === 'NEW')).toBe(true);

        // 验证洗牌（顺序不可预测，但应该有混合）
        expect(result).toHaveLength(10);
    });

    it('D2: 排除已加载词汇', async () => {
        const excludeIds = [1, 2, 3, 4, 5];

        (prisma.userProgress.findMany as any).mockResolvedValue([]);
        (prisma.vocab.findMany as any).mockImplementation(({ where }: any) => {
            // 验证 excludeIds 在查询中
            if (where?.id?.notIn) {
                expect(where.id.notIn).toEqual(expect.arrayContaining(excludeIds));
            }
            return Promise.resolve([createVocab(10)]);
        });

        await fetchOMPSCandidates(MOCK_USER_ID, 5, {}, excludeIds);
    });

    it('D3: 连续请求不重复', async () => {
        (prisma.userProgress.findMany as any).mockResolvedValue([]);

        let vocabId = 1;
        (prisma.vocab.findMany as any).mockImplementation(({ take }: any) =>
            Promise.resolve(Array.from({ length: take }, () => createVocab(vocabId++)))
        );

        // 第一批
        const batch1 = await fetchOMPSCandidates(MOCK_USER_ID, 5);
        const batch1Ids = batch1.map(c => c.vocabId);

        // 第二批（传入第一批的 ID 作为排除）
        const batch2 = await fetchOMPSCandidates(MOCK_USER_ID, 5, {}, batch1Ids);

        // 验证无重复
        const allIds = [...batch1Ids, ...batch2.map(c => c.vocabId)];
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(allIds.length);
    });

});

// ============================================
// Suite E: Inventory First Strategy (库存优先 + 去重)
// ============================================

describe('Suite E: Inventory First Strategy', () => {

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
        vi.clearAllMocks();
        // 默认 Redis 没数据
        (redis.keys as any).mockResolvedValue([]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('E1: 库存有词但未到期 -> 应过滤并返回空 (或走后续逻辑)', async () => {
        const vocabId = 101;
        const MODE = 'SYNTAX';

        // 1. Mock Redis 返回有库存
        (redis.keys as any).mockResolvedValue([`user:${MOCK_USER_ID}:mode:${MODE}:vocab:${vocabId}:drills`]);
        const mockPipeline = {
            llen: vi.fn(),
            exec: vi.fn().mockResolvedValue([[null, 5]]) // 库存充足
        };
        (redis.pipeline as any).mockReturnValue(mockPipeline);

        // 2. Mock DB 返回该词是 REVIEW 状态且未到期
        (prisma.vocab.findMany as any).mockImplementation(() => {
            const nextDay = new Date(Date.now() + 86400000);
            const vocab1 = createVocab(vocabId);
            const prog1 = createProgress(vocabId, nextDay, 'REVIEW');
            (vocab1 as any).progress = [prog1];
            return Promise.resolve([vocab1]);
        });

        // ... (E1 rest)

    });

    it('E2: 库存有词且已到期 -> 应该选中', async () => {
        const vocabId = 102;
        const MODE = 'SYNTAX';

        (redis.keys as any).mockResolvedValue([`user:${MOCK_USER_ID}:mode:${MODE}:vocab:${vocabId}:drills`]);
        const mockPipeline = {
            llen: vi.fn(),
            exec: vi.fn().mockResolvedValue([[null, 5]])
        };
        (redis.pipeline as any).mockReturnValue(mockPipeline);

        // 已到期 - 改用 mockImplementation
        (prisma.vocab.findMany as any).mockImplementation(() => {
            const past = new Date(Date.now() - 3600000); // 1 hour ago (relative to fake time)
            const vocab2 = createVocab(vocabId);
            const prog2 = createProgress(vocabId, past, 'REVIEW');
            (vocab2 as any).progress = [prog2];
            return Promise.resolve([vocab2]);
        });

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10, {}, [], MODE);

        const target = result.find(c => c.vocabId === vocabId);
        expect(target).toBeDefined();
        expect(target?.type).toBe('REVIEW');
    });

    it('E3: 库存里的新词 -> 应该选中', async () => {
        const vocabId = 201;
        const MODE = 'SYNTAX';

        (redis.keys as any).mockResolvedValue([`user:${MOCK_USER_ID}:mode:${MODE}:vocab:${vocabId}:drills`]);
        const mockPipeline = {
            llen: vi.fn(),
            exec: vi.fn().mockResolvedValue([[null, 5]])
        };
        (redis.pipeline as any).mockReturnValue(mockPipeline);

        // 新词 (无 progress)
        const vocab = createVocab(vocabId);
        (vocab as any).progress = []; // 无进度
        (prisma.vocab.findMany as any).mockResolvedValue([vocab]);

        const result = await fetchOMPSCandidates(MOCK_USER_ID, 10, {}, [], MODE);

        const target = result.find(c => c.vocabId === vocabId);
        expect(target).toBeDefined();
        expect(target?.type).toBe('NEW');
    });


});


