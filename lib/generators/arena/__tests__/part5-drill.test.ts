import { vi, describe, it, expect, beforeEach } from 'vitest';
import { buildArenaPart5Inputs } from '../part5-drill';
import { QuestionType } from '@prisma/client';

// ============================================
// Mock 配置
// ============================================

vi.mock('@/lib/db', () => {
    return {
        db: {
            questionSeed: {
                count: vi.fn(),
                findMany: vi.fn(),
                findFirst: vi.fn(),
                updateMany: vi.fn()
            }
        },
    };
});

import { db } from '@/lib/db';

const createMockCandidate = (id: number, word: string) => ({
    vocabId: id,
    word,
    definition_cn: '测试含义',
    word_family: {},
    collocations: [],
    confusion_audio: [],
    type: 'NEW' as const,
    partOfSpeech: 'n'
});

const createMockSeed = (id: string, type: QuestionType, grammarNodeId?: string) => ({
    id,
    sentence: 'The mock _______ is here.',
    targetAnswer: 'exam',
    options: [],
    questionType: type,
    part: 5,
    grammarNodeId: grammarNodeId || null
});

describe('Arena Part 5 Generator - Dual Funnel Dispatch', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // 默认预设：全局共有 100 道题
        (db.questionSeed.count as any).mockResolvedValue(100);
        // 屏蔽 updateMany 日志
        (db.questionSeed.updateMany as any).mockResolvedValue({ count: 1 });
    });

    it('Should trigger Level 2 Funnel (BKT Weakness) when targetType is GRAMMAR and weak nodes exist', async () => {
        // [设定]
        const candidates = [createMockCandidate(1, 'target1')];
        const pickTypeFn = () => 'GRAMMAR' as QuestionType;
        const weakNodeIds = ['node-A', 'node-B']; // 传入弱点知识点 ID

        let findManyCalls = 0;
        (db.questionSeed.findMany as any).mockImplementation((args: any) => {
            findManyCalls++;
            // 根据代码逻辑，对于 candidate index=0, (0%10)>=7 为 false，所以第一层 30% ExactMatch 被跳过。
            // 这里唯一触发的 findMany 就是 漏斗逻辑的弱点查询。
            expect(weakNodeIds).toContain(args.where.grammarNodeId);
            expect(args.where.questionType).toBe('GRAMMAR');
            return Promise.resolve([createMockSeed('seed-grammar-1', 'GRAMMAR', args.where.grammarNodeId)]);
        });

        // [执行]
        const result = await buildArenaPart5Inputs(candidates, pickTypeFn, weakNodeIds);

        // [验证]
        expect(result).toHaveLength(1);
        expect(result[0].input.seed.id).toBe('seed-grammar-1');
        // 第二层靶向漏斗触发了，就不应该再去通过 findFirst 泛查大盘了
        expect(db.questionSeed.findFirst).not.toHaveBeenCalled();
    });

    it('Should bypass Level 2 Funnel when targetType is NOT grammar/morphology', async () => {
        const candidates = [createMockCandidate(2, 'target2')];
        const pickTypeFn = () => 'COLLOCATION' as QuestionType;
        const weakNodeIds = ['node-A', 'node-B']; // 即使有弱点，也不会用

        (db.questionSeed.findFirst as any).mockResolvedValue(createMockSeed('seed-collocation-1', 'COLLOCATION'));

        await buildArenaPart5Inputs(candidates, pickTypeFn, weakNodeIds);

        // 验证：不会调用带有 grammarNodeId 的 findMany
        expect(db.questionSeed.findMany).toHaveBeenCalledTimes(0);
        expect(db.questionSeed.findFirst).toHaveBeenCalledTimes(1);
        expect((db.questionSeed.findFirst as any).mock.calls[0][0].where.questionType).toBe('COLLOCATION');
    });

    it('Should fallback to Level 1 big bucket when Level 2 Weakness query yields no seeds', async () => {
        const candidates = [createMockCandidate(3, 'target3')];
        const pickTypeFn = () => 'MORPHOLOGY' as QuestionType;
        const weakNodeIds = ['node-rare'];

        let findManyCalls = 0;
        (db.questionSeed.findMany as any).mockImplementation(() => {
            findManyCalls++;
            return Promise.resolve([]); // 靶向找语法结点为空
        });

        (db.questionSeed.findFirst as any).mockResolvedValue(createMockSeed('seed-morph-generic', 'MORPHOLOGY'));

        const result = await buildArenaPart5Inputs(candidates, pickTypeFn, weakNodeIds);

        expect(findManyCalls).toBe(1); // 只找了弱点没找到
        expect(db.questionSeed.findFirst).toHaveBeenCalledTimes(1); // 成功降级到找大类
        expect(result[0].input.seed.id).toBe('seed-morph-generic');
    });
});
