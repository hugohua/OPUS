import 'server-only';
import { prisma } from '@/lib/db';
import { Vocab, UserProgress } from '@/generated/prisma/client';
import { createLogger } from '@/lib/logger';

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
     * 选择复习词 (Context)
     * 
     * 规则：
     * 1. 与 Target 共享至少一个 scenario
     * 2. 用户正在学习中 (status = LEARNING/REVIEW)
     * 3. 排除 Target 自身
     * 4. 按 dueDate 升序排序 (优先复习到期的)
     */
    async selectContextWords(
        targetVocab: Vocab,
        count: number = 5
    ): Promise<Vocab[]> {
        const targetScenarios = targetVocab.scenarios;

        log.info({
            targetWord: targetVocab.word,
            targetScenarios,
            requestedCount: count,
        }, 'Selecting context words');

        if (targetScenarios.length === 0) {
            log.warn({ targetWord: targetVocab.word }, 'Target has no scenarios, cannot select context');
            return [];
        }

        // 获取用户正在学习的词汇进度
        const learningProgress = await prisma.userProgress.findMany({
            where: {
                userId: this.userId,
                status: { in: ['LEARNING', 'REVIEW'] },
                vocabId: { not: targetVocab.id },
            },
            include: { vocab: true },
            orderBy: { dueDate: 'asc' },
        });

        // 筛选共享 scenario 的词汇
        const contextWords = learningProgress
            .filter(p => {
                const vocabScenarios = p.vocab.scenarios;
                return vocabScenarios.some(s => targetScenarios.includes(s));
            })
            .slice(0, count)
            .map(p => p.vocab);

        log.info({
            contextWords: contextWords.map(w => w.word),
            foundCount: contextWords.length,
        }, 'Context words selected');

        // 如果复习词不足，尝试降级策略：选择同 CEFR 等级的词汇
        if (contextWords.length < 1) {
            log.info('Fallback: selecting words by CEFR level');
            const fallbackWords = await this.selectFallbackContextWords(
                targetVocab,
                count - contextWords.length
            );
            contextWords.push(...fallbackWords);
        }

        return contextWords;
    }

    /**
     * 降级策略：选择同 CEFR 等级的词汇
     */
    private async selectFallbackContextWords(
        targetVocab: Vocab,
        count: number
    ): Promise<Vocab[]> {
        const fallbackWords = await prisma.vocab.findMany({
            where: {
                id: { not: targetVocab.id },
                cefrLevel: targetVocab.cefrLevel,
                learningPriority: { gte: 60 },
                scenarios: { isEmpty: false },
            },
            take: count,
            orderBy: { abceed_level: 'asc' },
        });

        log.info({
            fallbackWords: fallbackWords.map(w => w.word),
            cefrLevel: targetVocab.cefrLevel,
        }, 'Fallback context words selected');

        return fallbackWords;
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
