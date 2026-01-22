'use server';

import { prisma } from '@/lib/prisma';
import { createLogger } from '@/lib/logger';
import type { Vocab } from '@/generated/prisma/client';

const log = createLogger('get-next-drill');

// ============================================
// Types
// ============================================

interface DrillCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    word_family: any;
    priority_level: number; // 1=抢救队列, 2=复习队列, 3=新词队列
}

interface NextDrillResult {
    targetWord: string;
    vocabId: number; // [New]
    meaning: string;
    contextWords: string[];
    wordFamily: Record<string, string>;
}

// ============================================
// 核心逻辑: 三级漏斗模型 (3-Level Funnel)
// ============================================

/**
 * 获取下一个 Drill 单词
 * 实现 "生存优先 (Survival First)" 的三级漏斗算法
 */
export async function getNextDrillWord(userId: string): Promise<NextDrillResult | null> {
    try {
        // 1. 通过 SQL 瀑布流获取目标词
        const targetRaw = await prisma.$queryRaw<DrillCandidate[]>`
            /* 优先级 1: 抢救队列 (上限 6 个) */
            /* 目标: 句法薄弱词 (V < 30) */
            (
                SELECT 
                    v.id as "vocabId", 
                    v.word, 
                    v.definition_cn, 
                    v.word_family,
                    1 as priority_level
                FROM "UserProgress" up
                JOIN "Vocab" v ON up."vocabId" = v.id
                WHERE up."userId" = ${userId}
                  AND up.status = 'LEARNING'
                  AND up.dim_v_score < 30
                ORDER BY up.next_review_at ASC
                LIMIT 6
            )
            UNION ALL
            /* 优先级 2: 复习队列 (修正: 50% = 10个) */
            (
                SELECT 
                    v.id as "vocabId", 
                    v.word, 
                    v.definition_cn, 
                    v.word_family,
                    2 as priority_level
                FROM "UserProgress" up
                JOIN "Vocab" v ON up."vocabId" = v.id
                WHERE up."userId" = ${userId}
                  AND up.status = 'LEARNING'
                  AND up.next_review_at <= NOW()
                  AND up.dim_v_score >= 30 
                ORDER BY v.frequency_score DESC
                LIMIT 10
            )
            UNION ALL
            /* 优先级 3: 新词填充 (填满剩余坑位) */
            (
                SELECT 
                    v.id as "vocabId", 
                    v.word, 
                    v.definition_cn, 
                    v.word_family,
                    3 as priority_level
                FROM "Vocab" v
                LEFT JOIN "UserProgress" up ON v.id = up."vocabId" AND up."userId" = ${userId}
                WHERE (up.status IS NULL OR up.status = 'NEW')
                  AND (v.abceed_level <= 1 OR v.is_toeic_core = true)
                ORDER BY 
                  CASE 
                    WHEN v.word_family->>'v' IS NOT NULL THEN 1 
                    ELSE 2 
                  END ASC,
                  v.frequency_score DESC,
                  LENGTH(v.word) ASC
                LIMIT 10 
            )
            LIMIT 1;
        `;

        if (targetRaw.length === 0) {
            log.warn('未找到 Drill 候选词');
            return null;
        }

        const target = targetRaw[0];
        log.info({ word: target.word, level: target.priority_level }, '已选择 Drill 目标词');

        // 2. 获取语境词 (1+N 规则)
        const contextWords = await getContextWords(target.word);

        return {
            targetWord: target.word,
            vocabId: target.vocabId, // [New]
            meaning: target.definition_cn || '暂无释义',
            contextWords,
            wordFamily: (target.word_family as Record<string, string>) || { v: target.word },
        };

    } catch (error) {
        log.error({ error }, 'getNextDrillWord 执行错误');
        throw error;
    }
}

/**
 * 获取语境词
 * 规则: 必须是名词或形容词。严禁纯动词。
 */
async function getContextWords(targetWord: string): Promise<string[]> {
    const candidates = await prisma.$queryRaw<Array<{ word: string }>>`
        SELECT word 
        FROM "Vocab"
        WHERE word != ${targetWord}
          AND CHAR_LENGTH(word) > 3
          /* 规则: 必须包含名词或形容词形式 */
          AND (
            word_family->>'n' IS NOT NULL 
            OR word_family->>'adj' IS NOT NULL
          )
          /* 规则: 禁止纯动词 (如果既无名词也无形容词形式，则视为纯动词风险) */
          /* 注意: 上面的 AND 子句已经强制要求存在 n 或 adj，因此纯动词已被过滤 */
        ORDER BY RANDOM()
        LIMIT 3;
    `;

    return candidates.map(c => c.word);
}
