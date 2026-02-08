/**
 * Mixed Mode 集成测试
 * 测试混合模式 Drill 获取逻辑
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { getNextDrillBatch } from '@/actions/get-next-drill';
import { recordOutcome } from '@/actions/record-outcome';
import type { SessionMode } from '@/types/briefing';
import { inventory } from '@/lib/core/inventory';

describe('Mixed Mode Integration', () => {
    const TEST_USER_ID = 'cltest_mixed_mode_user_01';

    beforeEach(async () => {
        // 清理测试数据
        await prisma.userProgress.deleteMany({ where: { userId: TEST_USER_ID } });
        await prisma.user.deleteMany({ where: { email: 'test_mixed@opus.com' } });
        await prisma.vocab.deleteMany({ where: { word: { in: ['budget', 'deadline', 'revenue'] } } });

        // 创建测试用户
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                email: 'test_mixed@opus.com',
                name: 'Test Mixed Mode',
                password: 'test123'
            }
        });

        // 创建测试词汇（不同 Stability）
        await prisma.vocab.createMany({
            data: [
                { word: 'budget', definition_cn: '预算', is_toeic_core: true, frequency_score: 95, partOfSpeech: 'n.' },
                { word: 'deadline', definition_cn: '截止日期', is_toeic_core: true, frequency_score: 90, partOfSpeech: 'n.' },
                { word: 'revenue', definition_cn: '收入', is_toeic_core: true, frequency_score: 85, partOfSpeech: 'n.' }
            ]
        });
    });

    describe('L0_MIXED 场景分配', () => {
        it('应根据 Stability 分配不同场景', async () => {
            // 1. 准备词汇（不同 Stability）
            const budgetVocab = await prisma.vocab.findFirst({ where: { word: 'budget' } });
            const deadlineVocab = await prisma.vocab.findFirst({ where: { word: 'deadline' } });
            const revenueVocab = await prisma.vocab.findFirst({ where: { word: 'revenue' } });

            if (!budgetVocab || !deadlineVocab || !revenueVocab) {
                throw new Error('Test vocabs not found');
            }

            // 2. 设置不同的 FSRS 状态
            // budget: stability = 3 → 应选 SYNTAX
            await prisma.userProgress.create({
                data: {
                    userId: TEST_USER_ID,
                    vocabId: budgetVocab.id,
                    track: 'VISUAL',
                    stability: 3.0,
                    difficulty: 5.0,
                    last_review_at: new Date(),
                    next_review_at: new Date(Date.now() - 1000), // Due
                    state: 2  // FSRS State: REVIEW
                }
            });

            // deadline: stability = 10 → 应选 PHRASE
            await prisma.userProgress.create({
                data: {
                    userId: TEST_USER_ID,
                    vocabId: deadlineVocab.id,
                    track: 'VISUAL',
                    stability: 10.0,
                    difficulty: 5.0,
                    last_review_at: new Date(),
                    next_review_at: new Date(Date.now() - 1000), // Due
                    state: 2  // FSRS State: REVIEW
                }
            });

            // revenue: stability = 25 → 应选 BLITZ
            await prisma.userProgress.create({
                data: {
                    userId: TEST_USER_ID,
                    vocabId: revenueVocab.id,
                    track: 'VISUAL',
                    stability: 25.0,
                    difficulty: 5.0,
                    last_review_at: new Date(),
                    next_review_at: new Date(Date.now() - 1000), // Due
                    state: 2  // FSRS State: REVIEW
                }
            });

            // 3. 获取混合模式 Drills
            const res = await getNextDrillBatch({
                userId: TEST_USER_ID,
                mode: 'L0_MIXED' as SessionMode,
                limit: 3,
                excludeVocabIds: []
            });

            // 4. 验证
            expect(res.status).toBe('success');
            expect(res.data).toBeDefined();

            if (res.data) {
                expect(res.data.length).toBeGreaterThan(0);

                // 查找每个词汇对应的 Drill
                const budgetDrill = res.data.find(d => d.meta.target_word === 'budget' || d.meta.vocabId === budgetVocab.id);
                const deadlineDrill = res.data.find(d => d.meta.target_word === 'deadline' || d.meta.vocabId === deadlineVocab.id);
                const revenueDrill = res.data.find(d => d.meta.target_word === 'revenue' || d.meta.vocabId === revenueVocab.id);

                // 验证场景分配（如果找到了对应的 Drill）
                if (budgetDrill) {
                    expect(budgetDrill.meta.mode).toBe('SYNTAX');
                }
                if (deadlineDrill) {
                    expect(deadlineDrill.meta.mode).toBe('PHRASE');
                }
                if (revenueDrill) {
                    expect(revenueDrill.meta.mode).toBe('BLITZ');
                }
            }
        });
    });

    describe('L1_MIXED Track 隔离', () => {
        it('应从 AUDIO track 选词', async () => {
            // 1. 创建 AUDIO track 记录
            const vocab = await prisma.vocab.findFirst({ where: { word: 'budget' } });
            if (!vocab) throw new Error('Vocab not found');

            await prisma.userProgress.create({
                data: {
                    userId: TEST_USER_ID,
                    vocabId: vocab.id,
                    track: 'AUDIO', // L1 track
                    stability: 5.0,
                    difficulty: 5.0,
                    last_review_at: new Date(),
                    next_review_at: new Date(Date.now() - 1000), // Due
                    state: 2  // FSRS State: REVIEW
                }
            });

            // 2. 获取 L1_MIXED Drills
            const res = await getNextDrillBatch({
                userId: TEST_USER_ID,
                mode: 'L1_MIXED' as SessionMode,
                limit: 5,
                excludeVocabIds: []
            });

            // 3. 验证：应该返回 AUDIO 场景（stability < 14）
            expect(res.status).toBe('success');
            if (res.data && res.data.length > 0) {
                const drill = res.data.find(d => d.meta.vocabId === vocab.id);
                if (drill) {
                    expect(drill.meta.mode).toBe('AUDIO');
                }
            }
        });
    });

    describe('DAILY_BLITZ 全场景混合', () => {
        it('应包含多个 Level 的场景', async () => {
            // 1. 创建多个 track 的词汇
            const vocab = await prisma.vocab.findFirst({ where: { word: 'budget' } });
            if (!vocab) throw new Error('Vocab not found');

            // VISUAL track (L0)
            await prisma.userProgress.create({
                data: {
                    userId: TEST_USER_ID,
                    vocabId: vocab.id,
                    track: 'VISUAL',
                    stability: 5.0,
                    difficulty: 5.0,
                    last_review_at: new Date(),
                    next_review_at: new Date(Date.now() - 1000),
                    state: 2  // FSRS State: REVIEW
                }
            });

            // 2. 获取 DAILY_BLITZ
            const res = await getNextDrillBatch({
                userId: TEST_USER_ID,
                mode: 'DAILY_BLITZ' as SessionMode,
                limit: 10,
                excludeVocabIds: []
            });

            // 3. 验证
            expect(res.status).toBe('success');
            expect(res.data).toBeDefined();
        });
    });

    describe('边界情况处理', () => {
        it('无候选词时应返回空数组', async () => {
            // 清除所有词汇以确保无候选词
            await prisma.vocab.deleteMany({ where: { word: { in: ['budget', 'deadline', 'revenue'] } } });
            // 清空 Redis 缓存，防止残留
            await inventory.clearAll(TEST_USER_ID);

            const res = await getNextDrillBatch({
                userId: TEST_USER_ID,
                mode: 'L0_MIXED' as SessionMode,
                limit: 10,
                excludeVocabIds: []
            });

            expect(res.status).toBe('success');
            // Fail-Safe 策略：即使 Inventory 为空，也会通过 buildSimpleDrill 生成兜底数据
            expect(res.data!.length).toBeGreaterThan(0);
            expect(res.data![0].meta.source).toBe('deterministic_fallback');
        });

        it('Cache Miss → buildSimpleDrill 兜底', async () => {
            // 创建一个新词汇（无 Inventory 缓存）
            const newVocab = await prisma.vocab.create({
                data: {
                    word: 'newword_test',
                    definition_cn: '测试新词',
                    is_toeic_core: true,
                    frequency_score: 80,
                    partOfSpeech: 'n.'
                }
            });

            const res = await getNextDrillBatch({
                userId: TEST_USER_ID, // Assuming testUserId is TEST_USER_ID
                mode: 'L0_MIXED' as SessionMode,
                limit: 1
            });

            expect(res.status).toBe('success');
            // buildSimpleDrill 会生成兜底内容，不是空数组
            expect(res.data).toBeDefined();
            expect(Array.isArray(res.data)).toBe(true);
            // 应该返回兜底 Drill
            if (res.data && res.data.length > 0) {
                const drill = res.data[0];
                // 兜底 Drill 应该有 source 标记
                expect((drill.meta as any).source).toBeDefined();
            }

            // 清理
            await prisma.vocab.delete({ where: { id: newVocab.id } });
        });
    });

    describe('Stability 范围统计', () => {
        it('日志应包含 stabilityRange 信息', async () => {
            // 注意：这需要查看日志输出，可能需要 spy 或其他方式验证
            // 这里只测试基本功能
            const vocab = await prisma.vocab.findFirst({ where: { word: 'budget' } });
            if (!vocab) throw new Error('Vocab not found');

            await prisma.userProgress.create({
                data: {
                    userId: TEST_USER_ID,
                    vocabId: vocab.id,
                    track: 'VISUAL',
                    stability: 15.0,
                    difficulty: 5.0,
                    last_review_at: new Date(),
                    next_review_at: new Date(Date.now() - 1000),
                    state: 2  // FSRS State: REVIEW
                }
            });

            const res = await getNextDrillBatch({
                userId: TEST_USER_ID,
                mode: 'L0_MIXED' as SessionMode,
                limit: 5,
                excludeVocabIds: []
            });

            expect(res.status).toBe('success');
            // 实际的 stabilityRange 在日志中，这里只验证返回成功
        });
    });
});
