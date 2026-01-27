// import 'server-only';
import { prisma } from '@/lib/db';
import { PrismaClient, Vocab, UserProgress } from '@prisma/client';
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
     * 选择复习词 (Context) - Hybrid Mode (Vector First -> Tag Fallback)
     * 
     * 规则：
     * 1. 优先使用 Vector Search (Cosine Distance) 寻找语义相关的复习词
     * 2. 如果向量数据不足或匹配太少，自动回退到 Tag 匹配
     * 3. 始终限制在用户正在学习 (LEARNING/REVIEW) 的词范围内
     * 4. 排除 Target 自身
     */
    async selectContextWords(
        targetVocab: Vocab,
        count: number = 5
    ): Promise<Vocab[]> {
        log.info({
            targetWord: targetVocab.word,
            requestedCount: count,
        }, 'Selecting context words (Hybrid)');

        let contextWords: Vocab[] = [];

        // 1. 尝试 Vector Search
        // 前提: Target 必须有向量数据 (目前通过 raw query 检查或由上层保证，这里简单以此判断)
        //由于 Prisma 类型定义可能没包含 embedding (Unsupported), 我们尝试直接查
        try {
            contextWords = await this.selectContextWordsByVector(targetVocab, count);

            if (contextWords.length > 0) {
                log.info({
                    strategy: 'VECTOR',
                    count: contextWords.length,
                    words: contextWords.map(w => w.word)
                }, 'Context selected via Vector');
            }
        } catch (error) {
            log.warn({ error: String(error) }, 'Vector search failed, falling back to Tag');
        }

        // 2. 如果 Vector 结果不足，使用 Tag 补齐 (Fallback)
        if (contextWords.length < count) {
            const remainingCount = count - contextWords.length;
            log.info({ remainingCount }, 'Filling remaining slots with Tag strategy');

            const existingIds = contextWords.map(w => w.id);
            const tagWords = await this.selectContextWordsByTag(targetVocab, remainingCount, existingIds);

            contextWords.push(...tagWords);
        }

        return contextWords;
    }

    /**
     * 策略 A: 向量检索 (Cosine Distance)
     */
    private async selectContextWordsByVector(
        targetVocab: Vocab,
        count: number
    ): Promise<Vocab[]> {
        // 1. 检查 Target 是否有向量 (需要一次查询确认，或者直接在 queryRaw 中处理)
        // 为了简单，我们直接执行 Query，如果 Target 无向量，Distance 计算会失败或为空

        // 2. 执行向量搜索
        // 查找范围: UserProgress (LEARNING/REVIEW) JOIN Vocab
        // 排序: Cosine Distance (embedding <=> target_embedding)
        const vectorResults = await prisma.$queryRaw<Vocab[]>`
            SELECT v.*
            FROM "UserProgress" up
            JOIN "Vocab" v ON up."vocabId" = v.id
            WHERE up."userId" = ${this.userId}
              AND up.status IN ('LEARNING', 'REVIEW')
              AND v.id != ${targetVocab.id}
              AND v.embedding IS NOT NULL
              AND (SELECT embedding FROM "Vocab" WHERE id = ${targetVocab.id}) IS NOT NULL
            ORDER BY v.embedding <=> (SELECT embedding FROM "Vocab" WHERE id = ${targetVocab.id})
            LIMIT ${count};
        `;

        if (!vectorResults || vectorResults.length === 0) {
            return [];
        }

        return vectorResults;
    }

    /**
     * 策略 B: 标签匹配 (Legacy Tag Matching)
     */
    private async selectContextWordsByTag(
        targetVocab: Vocab,
        count: number,
        excludeIds: number[] = []
    ): Promise<Vocab[]> {
        const targetScenarios = targetVocab.scenarios;
        if (targetScenarios.length === 0) return [];

        const learningProgress = await prisma.userProgress.findMany({
            where: {
                userId: this.userId,
                status: { in: ['LEARNING', 'REVIEW'] },
                vocabId: { notIn: [targetVocab.id, ...excludeIds] },
            },
            include: { vocab: true },
            // Tag 模式下优先复习 Due 的，增加随机性
            orderBy: { dueDate: 'asc' },
        });

        const matched = learningProgress
            .filter(p => {
                const vocabScenarios = p.vocab.scenarios;
                return vocabScenarios.some(s => targetScenarios.includes(s));
            })
            .slice(0, count)
            .map(p => p.vocab);

        return matched;
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
