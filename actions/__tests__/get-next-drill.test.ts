/**
 * get-next-drill.ts 单元测试 (V2.0)
 * 
 * 测试套件结构：
 * - Suite A: 基础功能 (空候选词、正常返回)
 * - Suite B: OMPS 调用参数验证
 * - Suite C: 缓存命中/未命中场景
 * - Suite D: 批量急救触发
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BriefingPayload } from '@/types/briefing';

// --- Mocks (声明在所有 import 之前, Vitest 会自动 hoist) ---

// Mock OMPS Core (主要选词逻辑)
vi.mock('@/lib/services/omps-core', () => ({
    fetchOMPSCandidates: vi.fn(),
}));

// Mock Inventory (缓存层)
vi.mock('@/lib/core/inventory', () => ({
    inventory: {
        popDrill: vi.fn(),
        triggerBatchEmergency: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock Deterministic Drill Builder (兜底生成)
vi.mock('@/lib/templates/deterministic-drill', () => ({
    buildSimpleDrill: vi.fn(),
}));

// Mock Audit Service
vi.mock('@/lib/services/audit-service', () => ({
    auditSessionFallback: vi.fn(),
    auditInventoryEvent: vi.fn(),
}));

// Mock Logger
vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

// Mock DB (avoid import errors)
vi.mock('@/lib/db', () => ({
    db: {},
    prisma: {},
}));

vi.mock('server-only', () => ({}));

// 动态导入被测模块
import { getNextDrillBatch } from '../get-next-drill';

// --- Test Data Factories ---

const createCandidate = (id: number, word: string = `word-${id}`) => ({
    vocabId: id,
    word,
    definition_cn: `定义-${id}`,
    definitions: { business_cn: `商务-${id}` },
    commonExample: `Example for ${word}`,
    phoneticUk: '/UK/',
    phoneticUs: '/US/',
    partOfSpeech: 'n',
    word_family: { parents: [], children: [] },
    priority_level: 1,
    frequency_score: 100,
    etymology: null,
    collocations: {},
    type: 'NEW' as const,
    confusion_audio: [],
});

const createCachedDrill = (vocabId: number): BriefingPayload => ({
    meta: {
        format: 'chat',
        target_word: `word-${vocabId}`,
        mode: 'SYNTAX',
        batch_size: 10,
        sys_prompt_version: 'v2.0',
    },
    segments: [
        { type: 'text', content_markdown: 'Cached content.' },
        { type: 'interaction', dimension: 'V', task: { style: 'swipe_card', question_markdown: '?', options: ['A', 'B'], answer_key: 'A' } }
    ],
});

const createFallbackDrill = (vocabId: number): BriefingPayload => ({
    meta: {
        format: 'chat',
        target_word: `word-${vocabId}`,
        mode: 'SYNTAX',
        batch_size: 10,
        sys_prompt_version: 'v2.0',
    },
    segments: [
        { type: 'text', content_markdown: 'Fallback content.' },
    ],
});

// --- Test Constants ---
const TEST_USER_ID = 'cm66x5x5x000008l4am90956r'; // Valid CUID format

// ============================================
// Suite A: 基础功能
// ============================================

describe('Suite A: 基础功能', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('A1: 空候选词应返回空数组', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([]);

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX' });


        expect(result.status).toBe('success');
        expect(result.data).toEqual([]);
        expect(result.message).toBe('No candidates found');
    });

    it('A2: 正常返回应包含 Drill 数组', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');

        vi.mocked(fetchOMPSCandidates).mockResolvedValue([createCandidate(1)]);
        vi.mocked(inventory.popDrill).mockResolvedValue(createCachedDrill(1));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 1 });

        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(1);
    });
});

// ============================================
// Suite B: OMPS 调用参数验证
// ============================================

describe('Suite B: OMPS 调用参数验证', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('B1: SYNTAX 模式应传递词性过滤器', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([]);

        await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX' });

        expect(fetchOMPSCandidates).toHaveBeenCalledWith(
            TEST_USER_ID,
            10,
            expect.objectContaining({
                posFilter: expect.arrayContaining(['v', 'n', 'vi', 'vt'])
            }),
            [], // Zod default
            'SYNTAX'
        );
    });

    it('B2: PHRASE 模式不应传递词性过滤器', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([]);

        await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'PHRASE' });

        expect(fetchOMPSCandidates).toHaveBeenCalledWith(
            TEST_USER_ID,
            10,
            { posFilter: undefined },  // Exact match
            [], // Zod default
            'PHRASE'
        );
    });

    it('B3: excludeVocabIds 应正确传递', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([]);

        await getNextDrillBatch({
            userId: TEST_USER_ID,
            mode: 'SYNTAX',
            excludeVocabIds: [1, 2, 3]
        });

        expect(fetchOMPSCandidates).toHaveBeenCalledWith(
            TEST_USER_ID,
            10,
            expect.anything(),
            [1, 2, 3],
            'SYNTAX'
        );
    });

    it('B4: limit 参数应正确传递', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        vi.mocked(fetchOMPSCandidates).mockResolvedValue([]);

        await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 5 });

        expect(fetchOMPSCandidates).toHaveBeenCalledWith(
            TEST_USER_ID,
            5,
            expect.anything(),
            [], // Zod default
            'SYNTAX'
        );
    });
});

// ============================================
// Suite C: 缓存命中场景
// ============================================

describe('Suite C: 缓存命中场景', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('C1: 100% 缓存命中', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { auditInventoryEvent } = await import('@/lib/services/audit-service');

        const candidates = [createCandidate(1), createCandidate(2)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill)
            .mockResolvedValueOnce(createCachedDrill(1))
            .mockResolvedValueOnce(createCachedDrill(2));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 2 });

        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(2);
        expect((result.data![0].meta as any).source).toBe('cache_v2');
        expect((result.data![1].meta as any).source).toBe('cache_v2');
        expect(auditInventoryEvent).toHaveBeenCalledTimes(2);
        expect(inventory.triggerBatchEmergency).not.toHaveBeenCalled();
    });

    it('C2: 100% 缓存未命中 -> 全部兜底', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { buildSimpleDrill } = await import('@/lib/templates/deterministic-drill');
        const { auditSessionFallback } = await import('@/lib/services/audit-service');

        const candidates = [createCandidate(1), createCandidate(2)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill).mockResolvedValue(null);
        vi.mocked(buildSimpleDrill)
            .mockReturnValueOnce(createFallbackDrill(1))
            .mockReturnValueOnce(createFallbackDrill(2));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 2 });

        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(2);
        expect((result.data![0].meta as any).source).toBe('deterministic_fallback');
        expect(auditSessionFallback).toHaveBeenCalledTimes(2);
    });

    it('C3: 混合场景 (部分命中)', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { buildSimpleDrill } = await import('@/lib/templates/deterministic-drill');

        const candidates = [createCandidate(1), createCandidate(2)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill)
            .mockResolvedValueOnce(createCachedDrill(1))
            .mockResolvedValueOnce(null);
        vi.mocked(buildSimpleDrill).mockReturnValue(createFallbackDrill(2));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 2 });

        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(2);

        const sources = result.data!.map(d => (d.meta as any).source);
        expect(sources).toContain('cache_v2');
        expect(sources).toContain('deterministic_fallback');
    });

    it('C4: Redis 异常应降级到兜底', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { buildSimpleDrill } = await import('@/lib/templates/deterministic-drill');

        const candidates = [createCandidate(1)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill).mockRejectedValue(new Error('Redis connection failed'));
        vi.mocked(buildSimpleDrill).mockReturnValue(createFallbackDrill(1));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 1 });

        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(1);
        expect((result.data![0].meta as any).source).toBe('deterministic_fallback');
    });
});

// ============================================
// Suite D: 批量急救触发
// ============================================

describe('Suite D: 批量急救触发', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('D1: 缓存未命中应触发批量急救', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { buildSimpleDrill } = await import('@/lib/templates/deterministic-drill');

        const candidates = [createCandidate(1), createCandidate(2)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill).mockResolvedValue(null);
        vi.mocked(buildSimpleDrill)
            .mockReturnValueOnce(createFallbackDrill(1))
            .mockReturnValueOnce(createFallbackDrill(2));

        await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX' });

        expect(inventory.triggerBatchEmergency).toHaveBeenCalledWith(
            TEST_USER_ID,
            'SYNTAX',
            [1, 2]
        );
    });

    it('D2: 全部命中不应触发急救', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');

        const candidates = [createCandidate(1)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill).mockResolvedValue(createCachedDrill(1));

        await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX' });

        expect(inventory.triggerBatchEmergency).not.toHaveBeenCalled();
    });

    it('D3: 急救失败不应影响响应', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { buildSimpleDrill } = await import('@/lib/templates/deterministic-drill');

        const candidates = [createCandidate(1)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill).mockResolvedValue(null);
        vi.mocked(buildSimpleDrill).mockReturnValue(createFallbackDrill(1));
        vi.mocked(inventory.triggerBatchEmergency).mockRejectedValue(new Error('Queue failed'));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX' });

        expect(result.status).toBe('success');
        expect(result.data).toHaveLength(1);
    });
});

// ============================================
// Suite E: 元数据与统计
// ============================================

describe('Suite E: 元数据与统计', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('E1: Drill 元数据应包含 vocabId', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');

        vi.mocked(fetchOMPSCandidates).mockResolvedValue([createCandidate(123)]);
        vi.mocked(inventory.popDrill).mockResolvedValue(createCachedDrill(123));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 1 });

        expect((result.data![0].meta as any).vocabId).toBe(123);
    });

    it('E2: 返回结果应包含命中率统计', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { buildSimpleDrill } = await import('@/lib/templates/deterministic-drill');

        const candidates = [createCandidate(1), createCandidate(2)];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill)
            .mockResolvedValueOnce(createCachedDrill(1))
            .mockResolvedValueOnce(null);
        vi.mocked(buildSimpleDrill).mockReturnValue(createFallbackDrill(2));

        const result = await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 2 });

        expect(result.meta).toBeDefined();
        expect((result.meta as any).hitRate).toBe('50.0');
        expect((result.meta as any).count).toBe(2);
    });

    it('E3: buildSimpleDrill 应接收完整候选词数据', async () => {
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        const { inventory } = await import('@/lib/core/inventory');
        const { buildSimpleDrill } = await import('@/lib/templates/deterministic-drill');

        const candidates = [{
            vocabId: 1,
            word: 'test',
            definition_cn: '测试',
            definitions: { business_cn: '商务测试' },
            commonExample: 'Test example',
            phoneticUk: '/test/',
            partOfSpeech: 'v',
            word_family: { parents: [], children: [] },
            priority_level: 1,
            frequency_score: 100,
            etymology: { root: 'test' },
            collocations: { noun: ['case'] },
            type: 'NEW' as const,
            confusion_audio: [],
        }];
        vi.mocked(fetchOMPSCandidates).mockResolvedValue(candidates);
        vi.mocked(inventory.popDrill).mockResolvedValue(null);
        vi.mocked(buildSimpleDrill).mockReturnValue(createFallbackDrill(1));

        await getNextDrillBatch({ userId: TEST_USER_ID, mode: 'SYNTAX', limit: 1 });

        expect(buildSimpleDrill).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 1,
                word: 'test',
                definition_cn: '测试',
                definitions: { business_cn: '商务测试' },
                commonExample: 'Test example',
                phoneticUk: '/test/',
                partOfSpeech: 'v',
                etymology: { root: 'test' },
                collocations: { noun: ['case'] },
            }),
            'SYNTAX'
        );
    });
});
