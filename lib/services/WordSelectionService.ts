// import 'server-only';
import { prisma } from '@/lib/db';
import { PrismaClient, Vocab, UserProgress } from '@prisma/client';
import { createLogger } from '@/lib/logger';
import { ContextSelector } from '@/lib/ai/context-selector';
import { fetchOMPSCandidates } from '@/lib/services/omps-core';

const log = createLogger('word-selection');

// 测试用户 ID (Task 3.1 Auth 接入前使用)
const TEST_USER_ID = 'test-user-1';

/**
 * 选词服务
 * 
 * 实现 \"1+N\" 选词逻辑：
 * - 1 个 Target (通过 OMPS 策略选择)
 * - N 个 Context (复习词，与 Target 语义相关)
 */
export class WordSelectionService {
    private userId: string;

    constructor(userId?: string) {
        this.userId = userId || TEST_USER_ID;
    }

    /**
     * 选择目标词 (Target)
     * 
     * 规则：使用 OMPS 策略选择 1 个候选词
     * - 70% 概率选择到期复习词
     * - 30% 概率选择分层采样新词 (20% 简单 / 60% 核心 / 20% 困难)
     */
    async selectTargetWord(): Promise<Vocab | null> {
        log.info({ userId: this.userId }, 'Selecting target word via OMPS');

        // 使用 OMPS 获取 1 个候选词
        const candidates = await fetchOMPSCandidates(this.userId, 1);

        if (candidates.length === 0) {
            log.warn({ userId: this.userId }, 'No suitable target word found via OMPS');
            return null;
        }

        const candidate = candidates[0];

        // 获取完整的 Vocab 记录
        const targetWord = await prisma.vocab.findUnique({
            where: { id: candidate.vocabId }
        });

        if (targetWord) {
            log.info({
                targetWord: targetWord.word,
                type: candidate.type,
                vocabId: candidate.vocabId,
            }, 'Target word selected via OMPS');
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
