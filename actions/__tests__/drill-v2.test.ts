import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks
// ============================================
vi.mock('@/lib/db', () => ({
    db: {
        userProgress: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            upsert: vi.fn()
        },
        vocab: {
            findFirst: vi.fn()
        },
        studyLog: {
            create: vi.fn()
        }
    }
}));

vi.mock('@/lib/queue/connection', () => ({
    redis: {
        zrangebyscore: vi.fn(),
        zrem: vi.fn(),
        zadd: vi.fn(),
        hgetall: vi.fn(),
        hset: vi.fn(),
        expire: vi.fn()
    }
}));

vi.mock('@/lib/inventory', () => ({
    inventory: {
        popDrillV2: vi.fn(),
        triggerEmergency: vi.fn()
    }
}));

vi.mock('@/lib/templates/deterministic-drill', () => ({
    buildSimpleDrill: vi.fn().mockReturnValue({ meta: { mode: 'SYNTAX' }, segments: [] })
}));

vi.mock('@/lib/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
    })
}));

import { fetchNextDrillV2 } from '../get-next-drill-v2';
import { submitAnswerV2 } from '../submit-answer-v2';
import { db } from '@/lib/db';
import { redis } from '@/lib/queue/connection';
import { inventory } from '@/lib/inventory';

describe('D2: API 混合器与原子提交', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ============================================
    // fetchNextDrillV2 Tests
    // ============================================
    describe('fetchNextDrillV2 (混合器)', () => {
        it('优先返回注入队列的错题', async () => {
            const injectedDrill = JSON.stringify({
                vocabId: 123,
                drillType: 'S_V_O',
                meta: { vocabId: 123 }
            });
            (redis.zrangebyscore as any).mockResolvedValue([injectedDrill]);
            (redis.zrem as any).mockResolvedValue(1);

            const result = await fetchNextDrillV2('user1');

            expect(result.status).toBe('success');
            expect(result.data?.source).toBe('injection');
        });

        it('无注入时返回 FSRS 到期词', async () => {
            (redis.zrangebyscore as any).mockResolvedValue([]);
            (db.userProgress.findFirst as any).mockResolvedValue({
                vocabId: 456,
                dim_mea_score: 50,
                dim_vis_score: 30,
                dim_ctx_score: 80,
                vocab: { id: 456, word: 'test', definition_cn: '测试', confusing_words: ['tset'] }
            });
            (inventory.popDrillV2 as any).mockResolvedValue({
                meta: { drillType: 'VISUAL_TRAP' },
                segments: []
            });

            const result = await fetchNextDrillV2('user1');

            expect(result.status).toBe('success');
            expect(result.data?.source).toBe('inventory');
        });

        it('库存空时降级生成', async () => {
            (redis.zrangebyscore as any).mockResolvedValue([]);
            (db.userProgress.findFirst as any).mockResolvedValue({
                vocabId: 789,
                dim_mea_score: 50,
                dim_vis_score: 30,
                dim_ctx_score: 80,
                vocab: { id: 789, word: 'fallback', definition_cn: '降级' }
            });
            (inventory.popDrillV2 as any).mockResolvedValue(null);
            (inventory.triggerEmergency as any).mockResolvedValue(undefined);

            const result = await fetchNextDrillV2('user1');

            expect(result.status).toBe('success');
            expect(result.data?.source).toBe('deterministic');
        });
    });

    // ============================================
    // submitAnswerV2 Tests
    // ============================================
    describe('submitAnswerV2 (原子提交)', () => {
        beforeEach(() => {
            (redis.hgetall as any).mockResolvedValue({});
            (redis.hset as any).mockResolvedValue(1);
            (redis.expire as any).mockResolvedValue(1);
            (redis.zadd as any).mockResolvedValue(1);
            (db.studyLog.create as any).mockResolvedValue({ id: 'log1' });
            (db.userProgress.findUnique as any).mockResolvedValue({ dim_mea_score: 50 });
            (db.userProgress.upsert as any).mockResolvedValue({});
        });

        it('正确计算隐式评分 (Pass < 1.5s = Easy)', async () => {
            const result = await submitAnswerV2({
                userId: 'user1',
                vocabId: 123,
                drillType: 'VISUAL_TRAP', // 非 S_V_O，不降权
                isPass: true,
                timeSpent: 1000
            });

            expect(result.status).toBe('success');
            expect(result.data?.grade).toBe(4); // Easy
        });

        it('题型权重修正: S_V_O Easy 降为 Good', async () => {
            const result = await submitAnswerV2({
                userId: 'user1',
                vocabId: 123,
                drillType: 'S_V_O',
                isPass: true,
                timeSpent: 500 // < 1.5s 本应是 Easy
            });

            expect(result.status).toBe('success');
            expect(result.data?.grade).toBe(3); // 降为 Good
        });

        it('错题写入注入队列', async () => {
            const result = await submitAnswerV2({
                userId: 'user1',
                vocabId: 123,
                drillType: 'PART5_CLOZE',
                isPass: false,
                timeSpent: 3000
            });

            expect(result.status).toBe('success');
            expect(result.data?.grade).toBe(1); // Again
            expect(result.data?.needsInjection).toBe(true);
            expect(redis.zadd).toHaveBeenCalledWith(
                'injection:user1',
                expect.any(Number),
                expect.any(String)
            );
        });

        it('更新 Redis 活跃窗口', async () => {
            await submitAnswerV2({
                userId: 'user1',
                vocabId: 123,
                drillType: 'S_V_O',
                isPass: true,
                timeSpent: 2000
            });

            expect(redis.hset).toHaveBeenCalledWith(
                'window:user1:123',
                expect.objectContaining({
                    lastGrade: '3',
                    attempts: '1'
                })
            );
        });

        it('写入 StudyLog 流水', async () => {
            await submitAnswerV2({
                userId: 'user1',
                vocabId: 123,
                drillType: 'VISUAL_TRAP',
                isPass: true,
                timeSpent: 2000
            });

            expect(db.studyLog.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user1',
                    vocabId: 123,
                    drillType: 'VISUAL_TRAP',
                    dimension: 'VIS',
                    result: 'PASS',
                    grade: 3
                })
            });
        });
    });
});
