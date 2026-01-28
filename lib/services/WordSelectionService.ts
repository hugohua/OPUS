// import 'server-only';
import { prisma } from '@/lib/db';
import { PrismaClient, Vocab, UserProgress } from '@prisma/client';
import { createLogger } from '@/lib/logger';
import { ContextSelector } from '@/lib/ai/context-selector';

const log = createLogger('word-selection');

// 测试用户 ID (Task 3.1 Auth 接入前使用)
const TEST_USER_ID = 'test-user-1';

/**
 * 选词服务
 * 
 * 实现 "1+N" 选词逻辑：
 * - 1 个 Target (新词)
 * - N 个 Context (复习词，与 Target 共享 scenario)
 */
export class WordSelectionService {
    private userId: string;

    constructor(userId?: string) {
        this.userId = userId || TEST_USER_ID;
    }

    /**
     * 选择目标新词 (Target)
     * 
     * 规则：
     * 1. learningPriority >= 60 (Core/Support 词汇)
     * 2. 用户未学习过 (无 UserProgress 或 status = NEW)
     * 3. 必须有 scenarios 标签
     * 4. 按优先级降序 + abceed_level 升序排序
     */
    async selectTargetWord(): Promise<Vocab | null> {
        log.info({ userId: this.userId }, 'Selecting target word');

        // 获取用户已学习的词汇 ID
        const learnedVocabIds = await prisma.userProgress.findMany({
            where: {
                userId: this.userId,
                status: { not: 'NEW' },
            },
            select: { vocabId: true },
        });

        const excludeIds = learnedVocabIds.map(p => p.vocabId);

        // 查询符合条件的新词
        const targetWord = await prisma.vocab.findFirst({
            where: {
                learningPriority: { gte: 60 },
                id: { notIn: excludeIds.length > 0 ? excludeIds : undefined },
                scenarios: { isEmpty: false },
            },
            orderBy: [
                { learningPriority: 'desc' },
                { abceed_level: 'asc' },
            ],
        });

        if (targetWord) {
            log.info({
                targetWord: targetWord.word,
                priority: targetWord.learningPriority,
                scenarios: targetWord.scenarios,
            }, 'Target word selected');
        } else {
            log.warn({ userId: this.userId }, 'No suitable target word found');
        }

        return targetWord;
    }

    /**
     * 选择复习词 (Context) - Delegated to ContextSelector
     * 策略: [USER_VECTOR, TAG] (前台模式：User Vector 优先，Tag 兜底，不开 Global Vector 以提升速度)
     */
    async selectContextWords(
        targetVocab: Vocab,
        count: number = 5
    ): Promise<Vocab[]> {
        log.info({
            targetWord: targetVocab.word,
            requestedCount: count,
        }, 'Selecting context words (via ContextSelector)');

        // 使用 ContextSelector (Shared Capability)
        // 策略: USER_VECTOR -> TAG (Goldilocks Zone applied by default in Vector)
        const contextWords = await ContextSelector.select(this.userId, targetVocab.id, {
            count,
            strategies: ['USER_VECTOR', 'TAG'],
            minDistance: 0.15,
            maxDistance: 0.5,
            excludeIds: [targetVocab.id]
        });

        // 记录日志，保持原有风格
        if (contextWords.length > 0) {
            log.info({
                count: contextWords.length,
                words: contextWords.map(w => w.word)
            }, 'Context selected via ContextSelector');
        }

        return contextWords;
    }

    /**
     * 获取选词结果 (Target + Context + Scenario)
     */
    async getWordSelection(): Promise<{
        targetWord: Vocab;
        contextWords: Vocab[];
        scenario: string;
    } | null> {
        const targetWord = await this.selectTargetWord();

        if (!targetWord) {
            return null;
        }

        const contextWords = await this.selectContextWords(targetWord);

        // 选择最合适的场景 (Target 的第一个场景)
        const scenario = targetWord.scenarios[0] || 'general_business';

        return {
            targetWord,
            contextWords,
            scenario,
        };
    }
}
