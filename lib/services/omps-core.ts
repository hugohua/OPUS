/**
 * OMPS Core - 共享选词逻辑
 * 
 * 功能：
 *   提供统一的选词逻辑，供 Session Drill 和 Article Mode 共用。
 *   实现 70/30 宏观调度 + 分层采样微观选词。
 * 
 * 使用方法：
 *   import { fetchOMPSCandidates } from '@/lib/services/omps-core';
 *   const candidates = await fetchOMPSCandidates(userId, 10);
 */

import { db as prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { redis } from '@/lib/queue/connection';

const log = createLogger('lib:omps-core');

// --- 类型定义 ---

export interface OMPSCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    word_family: any;
    priority_level: number;
    frequency_score: number;
    commonExample: string | null;
    collocations?: any;
    type: 'REVIEW' | 'NEW';
    reviewData?: any;
}

export interface OMPSConfig {
    reviewRatio: number;   // 默认 0.7
    simpleRatio: number;   // 默认 0.2
    coreRatio: number;     // 默认 0.6 (实际通过 1 - simple - hard 计算)
    hardRatio: number;     // 默认 0.2
    posFilter?: string[];  // 词性过滤 (可选)
}

const DEFAULT_CONFIG: OMPSConfig = {
    reviewRatio: 0.7,
    simpleRatio: 0.2,
    coreRatio: 0.6,
    hardRatio: 0.2,
};

// ============================================
// 主入口：fetchOMPSCandidates
// ============================================

/**
 * 获取符合 OMPS 策略的候选词列表
 * 
 * @param userId 用户 ID
 * @param limit 需要的总数量
 * @param config 可选配置 (覆盖默认比例)
 * @param excludeIds 排除的词汇 ID 列表
 * @param mode 可选的 Session 模式，用于库存优先策略
 */
export async function fetchOMPSCandidates(
    userId: string,
    limit: number,
    config?: Partial<OMPSConfig>,
    excludeIds: number[] = [],
    mode?: string
): Promise<OMPSCandidate[]> {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    // --- Phase 0: 库存优先策略 (Inventory-First) ---
    let hotCandidates: OMPSCandidate[] = [];
    if (mode) {
        hotCandidates = await getInventoryBackedWords(userId, mode, limit, excludeIds);
        if (hotCandidates.length >= limit) {
            log.info({
                userId,
                mode,
                hotCount: hotCandidates.length,
                limit
            }, '✅ 全部从库存获取');
            return shuffle(hotCandidates);
        }
    }

    // --- Phase 1: 宏观调度 (70/30) ---
    const remaining = limit - hotCandidates.length;
    const reviewQuota = Math.floor(remaining * cfg.reviewRatio);

    const hotVocabIds = hotCandidates.map(c => c.vocabId);
    const allExcludeIds = [...excludeIds, ...hotVocabIds];
    const excludeFilter = allExcludeIds.length > 0 ? { id: { notIn: allExcludeIds } } : {};

    // 1. 获取到期复习词 (Debt)
    const reviews = await prisma.userProgress.findMany({
        where: {
            userId,
            status: { in: ['LEARNING', 'REVIEW'] },
            next_review_at: { lte: new Date() },
            vocab: { ...excludeFilter }
        },
        take: reviewQuota,
        orderBy: { next_review_at: 'asc' },
        include: { vocab: true }
    });

    const reviewsMapped = reviews.map(r => mapToCandidate(r.vocab, 2, 'REVIEW', r));

    // 计算剩余名额
    const slotsFilled = hotCandidates.length + reviewsMapped.length;
    const slotsRemaining = limit - slotsFilled;

    // --- Phase 2: 微观采样 (分层新词) ---
    let newWordsMapped: OMPSCandidate[] = [];

    if (slotsRemaining > 0) {
        const reviewVocabIds = reviewsMapped.map(r => r.vocabId);
        newWordsMapped = await getStratifiedNewWords(
            userId,
            slotsRemaining,
            [...allExcludeIds, ...reviewVocabIds],
            cfg.posFilter
        );
    }

    // --- Phase 3: 整合 + 洗牌 ---
    const finalBatch = [...hotCandidates, ...reviewsMapped, ...newWordsMapped];

    log.info({
        userId,
        mode,
        limit,
        hotCount: hotCandidates.length,
        reviewCount: reviewsMapped.length,
        newCount: newWordsMapped.length
    }, 'OMPS candidates fetched');

    return shuffle(finalBatch);
}

// ============================================
// 分层采样：getStratifiedNewWords
// ============================================

export async function getStratifiedNewWords(
    userId: string,
    count: number,
    excludeIds: number[],
    posFilter?: string[]
): Promise<OMPSCandidate[]> {

    // 数量太少时直接走 Core
    if (count <= 1) {
        return fetchNewBucket(userId, 'CORE', count, excludeIds, posFilter);
    }

    // 目标比例：Simple 20% | Core 60% | Hard 20%
    const simpleCount = Math.round(count * 0.2);
    const hardCount = Math.round(count * 0.2);
    const coreCount = count - simpleCount - hardCount;

    // 并行查询
    const [simple, core, hard] = await Promise.all([
        fetchNewBucket(userId, 'SIMPLE', simpleCount, excludeIds, posFilter),
        fetchNewBucket(userId, 'CORE', coreCount, excludeIds, posFilter),
        fetchNewBucket(userId, 'HARD', hardCount, excludeIds, posFilter)
    ]);

    // 兜底：如果 Simple/Hard 不足，用 Core 补位
    let result = [...simple, ...core, ...hard];

    if (result.length < count) {
        const gap = count - result.length;
        const currentIds = result.map(x => x.vocabId).concat(excludeIds);
        const extra = await fetchNewBucket(userId, 'CORE', gap, currentIds, posFilter);
        result.push(...extra);
    }

    // 最终兜底：放宽所有条件
    if (result.length < count) {
        const gap = count - result.length;
        const currentIds = result.map(x => x.vocabId).concat(excludeIds);
        const fallback = await fetchNewBucket(userId, 'FALLBACK', gap, currentIds, posFilter);
        result.push(...fallback);
    }

    return result;
}

// ============================================
// 分桶获取：fetchNewBucket
// ============================================

export async function fetchNewBucket(
    userId: string,
    bucket: 'SIMPLE' | 'CORE' | 'HARD' | 'FALLBACK',
    limit: number,
    excludeIds: number[],
    posFilter?: string[]
): Promise<OMPSCandidate[]> {
    if (limit <= 0) return [];

    let whereCondition: any = {
        progress: { none: { userId } },
        ...(excludeIds.length > 0 ? { id: { notIn: excludeIds } } : {}),
        ...(posFilter ? { partOfSpeech: { in: posFilter } } : {}),
    };

    // 分层逻辑
    switch (bucket) {
        case 'SIMPLE':
            // Level 1-3
            whereCondition.abceed_level = { lte: 3 };
            break;
        case 'CORE':
            // TOEIC Core 或 Level 4-7
            whereCondition.OR = [
                { is_toeic_core: true },
                { abceed_level: { in: [4, 5, 6, 7] } }
            ];
            break;
        case 'HARD':
            // Level 8+
            whereCondition.abceed_level = { gte: 8 };
            break;
        case 'FALLBACK':
            // 无额外过滤
            break;
    }

    const words = await prisma.vocab.findMany({
        where: whereCondition,
        orderBy: [
            { is_toeic_core: 'desc' },
            { frequency_score: 'desc' }
        ],
        take: limit
    });

    return words.map(w => mapToCandidate(w, 3, 'NEW'));
}

// ============================================
// 库存优先：getInventoryBackedWords
// ============================================

/**
 * 获取 Redis 中已有库存的单词
 * 优先级：复习词 > 新词
 */
async function getInventoryBackedWords(
    userId: string,
    mode: string,
    limit: number,
    excludeIds: number[]
): Promise<OMPSCandidate[]> {
    try {
        // 1. 扫描 Redis，找到所有有库存的 vocabId
        const pattern = `user:${userId}:mode:${mode}:vocab:*:drills`;
        const keys = await redis.keys(pattern);

        if (keys.length === 0) return [];

        // 2. 提取 vocabId
        const vocabIds = keys
            .map(key => {
                const match = key.match(/vocab:(\d+):drills$/);
                return match ? parseInt(match[1]) : null;
            })
            .filter((id): id is number => id !== null && !excludeIds.includes(id));

        if (vocabIds.length === 0) return [];

        // 3. 批量检查库存数量（只保留 > 0 的）
        const pipeline = redis.pipeline();
        vocabIds.forEach(id => {
            pipeline.llen(`user:${userId}:mode:${mode}:vocab:${id}:drills`);
        });
        const results = await pipeline.exec();

        // 4. 过滤出有库存的
        const availableIds = vocabIds.filter((id, idx) => {
            const len = results?.[idx]?.[1] as number;
            return len > 0;
        });

        if (availableIds.length === 0) return [];

        // 5. 从数据库获取完整信息（包括 FSRS 状态）
        const vocabs = await prisma.vocab.findMany({
            where: { id: { in: availableIds } },
            include: {
                progress: {
                    where: { userId },
                    take: 1
                }
            }
        });

        // 6. 分类：复习词（REVIEW）vs 新词（NEW）
        const candidates: OMPSCandidate[] = [];

        for (const v of vocabs) {
            const prog = v.progress[0];

            // [Fix] 重复出现问题
            // 如果是复习词，必须检查 next_review_at 是否已到期
            // 因为 Redis 可能还有库存，但单词其实刚才已经在 Session 中复习过了（next_review_at 更新到了未来）
            if (prog && ['LEARNING', 'REVIEW'].includes(prog.status)) {
                // 如果未到期，跳过（即使有库存）
                if (prog.next_review_at && prog.next_review_at > new Date()) {
                    continue;
                }
                candidates.push(mapToCandidate(v, 2, 'REVIEW', prog));
            } else {
                candidates.push(mapToCandidate(v, 3, 'NEW'));
            }
        }

        // 7. 优先返回复习词，然后是新词
        candidates.sort((a, b) => {
            if (a.type === 'REVIEW' && b.type === 'NEW') return -1;
            if (a.type === 'NEW' && b.type === 'REVIEW') return 1;
            // 复习词按到期时间排序
            if (a.type === 'REVIEW' && b.type === 'REVIEW') {
                const aTime = (a.reviewData as any)?.next_review_at?.getTime() || 0;
                const bTime = (b.reviewData as any)?.next_review_at?.getTime() || 0;
                return aTime - bTime;
            }
            return 0;
        });

        return candidates.slice(0, limit);
    } catch (error) {
        log.error({ error, userId, mode }, 'Failed to fetch inventory-backed words');
        return [];
    }
}

// ============================================
// 工具函数
// ============================================

function mapToCandidate(
    v: any,
    priority: number,
    type: 'REVIEW' | 'NEW',
    reviewData?: any
): OMPSCandidate {
    return {
        vocabId: v.id,
        word: v.word,
        definition_cn: v.definition_cn,
        word_family: v.word_family,
        priority_level: priority,
        frequency_score: v.frequency_score,
        commonExample: v.commonExample,
        collocations: v.collocations,
        type,
        reviewData
    };
}

// Fisher-Yates 洗牌
function shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
