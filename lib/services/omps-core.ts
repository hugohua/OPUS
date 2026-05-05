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
import { auditOMPSSelection } from '@/lib/services/audit-service';
import { buildNotMasteredVocabWhere } from '@/lib/vocab-state/filters';

const log = createLogger('lib:omps-core');

// --- 类型定义 ---

// [New] Structured Definitions Schema
export interface VocabDefinitions {
    business_cn?: string;
    general_cn?: string;
    [key: string]: any; // Allow extensibility
}

export interface OMPSCandidate {
    vocabId: number;
    word: string;
    definition_cn: string;
    phoneticUk?: string | null;
    phoneticUs?: string | null; // [New]
    definitions?: VocabDefinitions; // [Fix] Strict typing replacing 'any'
    word_family: any;
    priority_level: number;
    frequency_score: number;
    commonExample: string | null;
    collocations?: any;
    partOfSpeech?: string | null; // [New] For Fallback Card
    type: 'REVIEW' | 'NEW';
    reviewData?: any;
    confusion_audio?: string[]; // [New] L1 Audio
    etymology?: any; // [New] Source Code
    userNote?: string; // [New] Feature A: User custom memory hook
    source?: 'rescue' | 'review' | 'new' | 'hot'; // [V3] 来源标记
}

export interface OMPSConfig {
    reviewRatio: number;   // 默认 0.7
    rescueRatio: number;   // [V3] 默认 0（Dojo 不需要）；Arena 传 0.3
    simpleRatio: number;   // 默认 0.2
    coreRatio: number;     // 默认 0.6 (实际通过 1 - simple - hard 计算)
    hardRatio: number;     // 默认 0.2
    posFilter?: string[];  // 词性过滤 (可选)
}

// --- 默认配置 ---
// reviewRatio: 0.7 是 FSRS 标准平衡值（Dojo 70/30 协议）。
// rescueRatio: 0 → 向后兼容，现有消费方无需改动。
// Arena 场景通过 OMPS_ARENA_CONFIG 传 rescueRatio: 0.3。
const DEFAULT_CONFIG: OMPSConfig = {
    reviewRatio: 0.7,   // 复习优先 ~70%
    rescueRatio: 0,     // [V3] 默认不启用 Rescue（Dojo 不需要）
    simpleRatio: 0.2,   // 新词分层: 简单 20%
    coreRatio: 0.6,     // 新词分层: 核心 60%
    hardRatio: 0.2,     // 新词分层: 困难 20%
};

// --- [V3] 协议预设 ---

/** Dojo 协议: 70% Review + 30% New（无 Rescue） */
export const OMPS_DOJO_CONFIG: Partial<OMPSConfig> = {
    rescueRatio: 0,
    reviewRatio: 0.7,
};

/** Arena 协议: 30% Rescue + 50% Review + 20% New (PRD §4.2) */
export const OMPS_ARENA_CONFIG: Partial<OMPSConfig> = {
    rescueRatio: 0.3,
    reviewRatio: 0.5,
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
// --- Helper: Mode to Track Mapping (Shared Logic) ---
function mapModeToTrack(mode?: string): string {
    if (!mode) return 'VISUAL'; // Default
    // L0: Syntax/Visual -> VISUAL
    if (['SYNTAX', 'VISUAL', 'BLITZ', 'PHRASE'].includes(mode)) return 'VISUAL';
    // L1: Audio -> AUDIO
    if (['AUDIO', 'CHUNKING'].includes(mode)) return 'AUDIO';
    // L2: Context -> CONTEXT
    if (['CONTEXT', 'NUANCE', 'READING'].includes(mode)) return 'CONTEXT';

    return 'VISUAL';
}

/**
 * 获取符合 OMPS 策略的候选词列表
 * 
 * @param userId 用户 ID
 * @param limit 需要的总数量
 * @param config 可选配置 (覆盖默认比例)
 * @param excludeIds 排除的词汇 ID 列表
 * @param mode 必选的 Session 模式，用于确定轨道 (Track) 和库存优先策略
 */
export async function fetchOMPSCandidates(
    userId: string,
    limit: number,
    config?: Partial<OMPSConfig>,
    excludeIds: number[] = [],
    mode?: string
): Promise<OMPSCandidate[]> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const currentTrack = mapModeToTrack(mode); // Determine Track

    // --- Phase 0: 库存优先策略 (Inventory-First) ---
    let hotCandidates: OMPSCandidate[] = [];
    if (mode) {
        hotCandidates = await getInventoryBackedWords(userId, mode, limit, excludeIds);
        // [V3] 标记来源
        hotCandidates.forEach(c => c.source = 'hot');
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

    // --- Phase 0.5: Rescue Queue (显式语法补救, PRD §4.2) ---
    let rescueCandidates: OMPSCandidate[] = [];
    if (cfg.rescueRatio > 0) {
        const rescueQuota = Math.floor(limit * cfg.rescueRatio);
        const rescueExcludeIds = [...excludeIds, ...hotCandidates.map(c => c.vocabId)];
        const rescueVocabWhere = {
            ...buildNotMasteredVocabWhere(userId),
            ...(rescueExcludeIds.length > 0 ? { id: { notIn: rescueExcludeIds } } : {}),
        };

        const rescueRecords = await prisma.userProgress.findMany({
            where: {
                userId,
                track: currentTrack,
                status: { in: ['LEARNING', 'REVIEW'] },
                dim_v_score: { lt: 30 },  // PRD 标准: Visual < 30
                vocab: rescueVocabWhere
            },
            take: rescueQuota,
            orderBy: { vocab: { frequency_score: 'desc' } }, // 高价值优先
            include: { vocab: { include: { etymology: true } } }
        });
        rescueCandidates = rescueRecords.map(r => {
            const c = mapToCandidate(r.vocab, 1, 'REVIEW', r);
            c.source = 'rescue';
            return c;
        });

        log.info({ rescueQuota, rescueFilled: rescueCandidates.length }, 'Rescue queue');
    }

    // --- Phase 1: 宏观调度 ---
    // [V3] remaining 减去 hot + rescue 已占用
    const filledBeforeReview = hotCandidates.length + rescueCandidates.length;
    const remaining = limit - filledBeforeReview;
    // 直接从 limit 计算 reviewQuota，rescue 溢出自然转给 review
    const reviewQuota = cfg.rescueRatio > 0
        ? Math.floor(limit * cfg.reviewRatio) + (Math.floor(limit * cfg.rescueRatio) - rescueCandidates.length)
        : Math.floor(remaining * cfg.reviewRatio);

    const prevVocabIds = [
        ...hotCandidates.map(c => c.vocabId),
        ...rescueCandidates.map(c => c.vocabId)
    ];
    const allExcludeIds = [...excludeIds, ...prevVocabIds];
    const reviewVocabWhere = {
        ...buildNotMasteredVocabWhere(userId),
        ...(allExcludeIds.length > 0 ? { id: { notIn: allExcludeIds } } : {}),
    };

    // 1. 获取到期复习词 (Debt) - [Fix] Multi-Track Filtering
    const reviews = await prisma.userProgress.findMany({
        where: {
            userId,
            track: currentTrack, // 🔥 Critical: Only fetch for current track
            status: { in: ['LEARNING', 'REVIEW'] },
            next_review_at: { lte: new Date() },
            vocab: reviewVocabWhere
        },
        take: reviewQuota,
        orderBy: { next_review_at: 'asc' },
        include: { vocab: { include: { etymology: true } } }
    });

    const reviewsMapped = reviews.map(r => {
        const c = mapToCandidate(r.vocab, 2, 'REVIEW', r);
        c.source = 'review';
        return c;
    });

    // 计算剩余名额
    const slotsFilled = filledBeforeReview + reviewsMapped.length;
    const slotsRemaining = limit - slotsFilled;

    // --- Phase 2: 微观采样 (分层新词) ---
    let newWordsMapped: OMPSCandidate[] = [];

    if (slotsRemaining > 0) {
        const reviewVocabIds = reviewsMapped.map(r => r.vocabId);
        // Note: New words don't strictly have a "track" yet until they are "learned".
        // But we filter out words the user has *already* started on this track?
        // Actually, fetchNewBucket checks `progress: { none: { userId } }` which means "User has NO progress on this word ANYWHERE".
        // This logic is slightly flawed for Multi-Track: User might have learned it in Visual, but it's "New" for Audio?
        // Requirement: "New Acquisition" usually means "Totally New Word". 
        // If we want "Cross-Track New" (e.g. learn Audio for known Visual word), that's a different logic.
        // For now, let's stick to "Totally New" to avoid complexity, or update fetchNewBucket to check `track`.

        newWordsMapped = await getStratifiedNewWords(
            userId,
            slotsRemaining,
            [...allExcludeIds, ...reviewVocabIds],
            cfg.posFilter,
            currentTrack // Pass track to exclude *only* words learned on *this* track? 
            // Or keep global "new"?
            // PRD says "Level 0 starts at Level 0". 
            // Level 1 starts with known words.
            // So this logic depends on Mode.
            // For simplicity in Phase 1, we keep "New means New to User (Global)" or adjust fetchNewBucket.
        );
    }

    // [V3] 标记新词来源
    newWordsMapped.forEach(c => c.source = 'new');

    // --- Phase 3: 整合 + 洗牌 ---
    const finalBatch = dedupeCandidates([
        ...hotCandidates,
        ...rescueCandidates,
        ...reviewsMapped,
        ...newWordsMapped
    ]);

    log.info({
        userId,
        mode,
        track: currentTrack,
        limit,
        hotCount: hotCandidates.length,
        rescueCount: rescueCandidates.length,
        reviewCount: reviewsMapped.length,
        newCount: newWordsMapped.length
    }, 'OMPS candidates fetched (V3)');

    // --- [V5.1] Panoramic Audit: Selection Logging ---
    auditOMPSSelection(userId, {
        mode,
        track: currentTrack,
        limit,
        excludeCount: excludeIds.length,
        reviewQuota
    }, {
        hotCount: hotCandidates.length,
        rescueCount: rescueCandidates.length,
        reviewCount: reviewsMapped.length,
        newCount: newWordsMapped.length,
        totalSelected: finalBatch.length,
        selectedIds: finalBatch.slice(0, 20).map(c => c.vocabId)
    });

    return shuffle(finalBatch);
}

// ============================================
// 分层采样：getStratifiedNewWords
// ============================================

export async function getStratifiedNewWords(
    userId: string,
    count: number,
    excludeIds: number[],
    posFilter?: string[],
    track?: string // [New]
): Promise<OMPSCandidate[]> {

    // 数量太少时直接走 Core
    if (count <= 1) {
        return fetchNewBucket(userId, 'CORE', count, excludeIds, posFilter, track);
    }

    // 目标比例：Simple 20% | Core 60% | Hard 20%
    const simpleCount = Math.round(count * 0.2);
    const hardCount = Math.round(count * 0.2);
    const coreCount = count - simpleCount - hardCount;

    // 顺序查询以避免跨桶重复（例如某词既是 Simple 又是 Core）
    const simple = await fetchNewBucket(userId, 'SIMPLE', simpleCount, excludeIds, posFilter, track);

    const excludeForCore = [...excludeIds, ...simple.map(x => x.vocabId)];
    const core = await fetchNewBucket(userId, 'CORE', coreCount, excludeForCore, posFilter, track);

    const excludeForHard = [...excludeForCore, ...core.map(x => x.vocabId)];
    const hard = await fetchNewBucket(userId, 'HARD', hardCount, excludeForHard, posFilter, track);

    // 兜底：如果 Simple/Hard 不足，用 Core 补位
    let result = [...simple, ...core, ...hard];

    if (result.length < count) {
        const gap = count - result.length;
        const currentIds = result.map(x => x.vocabId).concat(excludeIds);
        const extra = await fetchNewBucket(userId, 'CORE', gap, currentIds, posFilter, track);
        result.push(...extra);
    }

    // 最终兜底：放宽所有条件
    if (result.length < count) {
        const gap = count - result.length;
        const currentIds = result.map(x => x.vocabId).concat(excludeIds);
        const fallback = await fetchNewBucket(userId, 'FALLBACK', gap, currentIds, posFilter, track);
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
    posFilter?: string[],
    track?: string // [New]
): Promise<OMPSCandidate[]> {
    if (limit <= 0) return [];

    let whereCondition: any = {
        ...buildNotMasteredVocabWhere(userId),
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
        take: limit,
        include: { etymology: true }
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
        // [Fix] 必须只获取当前 Track 的进度，否则可能误读 Audio 进度为 Visual
        const currentTrack = mapModeToTrack(mode); // Shared logic helper

        const vocabs = await prisma.vocab.findMany({
            where: {
                ...buildNotMasteredVocabWhere(userId),
                id: { in: availableIds },
            },
            include: {
                progress: {
                    where: { userId, track: currentTrack },
                    take: 1
                },
                etymology: true
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
    // 解析 masteryMatrix (Feature A)
    let userNote: string | undefined = undefined;
    if (reviewData?.masteryMatrix && typeof reviewData.masteryMatrix === 'object') {
        const matrix = reviewData.masteryMatrix as Record<string, any>;
        if (typeof matrix.userNote === 'string') {
            userNote = matrix.userNote;
        }
    }

    return {
        vocabId: v.id,
        word: v.word,
        definition_cn: v.definition_cn,
        phoneticUk: v.phoneticUk, // [New]
        phoneticUs: v.phoneticUs, // [New]
        definitions: v.definitions, // [New]
        word_family: v.word_family,
        priority_level: priority,
        frequency_score: v.frequency_score,
        commonExample: v.commonExample,
        collocations: v.collocations,
        type,
        reviewData,
        confusion_audio: v.confusion_audio || [],
        etymology: v.etymology, // [New]
        userNote // [New] User custom memory hint
    };
}

function dedupeCandidates(candidates: OMPSCandidate[]): OMPSCandidate[] {
    const seen = new Set<number>();
    const result: OMPSCandidate[] = [];

    for (const candidate of candidates) {
        if (seen.has(candidate.vocabId)) continue;
        seen.add(candidate.vocabId);
        result.push(candidate);
    }

    return result;
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
