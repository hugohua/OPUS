'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('actions:drive');

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
import {
    DriveItem,
    DriveMode,
    DriveTrack,
    DrivePlaylistResponse,
    DrivePlaylistOptions,
    DRIVE_VOICE_CONFIG,
    DRIVE_VOICE_SPEED_PRESETS
} from '@/lib/constants/drive';

// ------------------------------------------------------------------
// Algorithm: Sandwich (Warmup -> Review -> Break)
// V2: 支持多轨道 + Cursor-based 分页
// ------------------------------------------------------------------
export async function generateDrivePlaylist(
    options: DrivePlaylistOptions = {}
): Promise<DrivePlaylistResponse> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }
    const userId = session.user.id;

    // 解构参数，设置默认值
    const track: DriveTrack = options.track || 'VISUAL';
    const cursor = options.cursor || 0;
    const pageSize = options.pageSize || 15;

    log.info({ userId, track, cursor, pageSize }, 'Generating playlist V2');

    // ✅ Transaction: 确保所有查询在同一快照下执行
    const [warmupItems, reviewItems, breakItems, totalCount] = await db.$transaction(async (tx) => {
        // 获取总数用于判断 hasMore
        const total = await tx.userProgress.count({
            where: { userId, track }
        });

        return await Promise.all([
            fetchWarmupItems(userId, 3, track, tx),
            fetchReviewItems(userId, pageSize - 5, track, tx, cursor), // Review 承担主要分页
            fetchBreakChunks(userId, 2, tx),
            Promise.resolve(total)
        ]);
    });

    // 组装 Playlist
    const rawPlaylist: DriveItem[] = [
        ...warmupItems,
        ...reviewItems,
        ...breakItems
    ];

    // DJ Shuffle (场景聚类 + 难度穿插)
    const items = opusDjShuffle(rawPlaylist);

    // 计算分页元数据
    // ⚠️ 注意: hasMore 是基于 track 总记录数的近似估算
    // 实际可用词可能因 stability/due 过滤而更少，但这个估算足够用于 UI 决策
    const nextCursor = cursor + reviewItems.length;
    const hasMore = nextCursor < totalCount;

    log.info({
        total: items.length,
        warmup: warmupItems.length,
        review: reviewItems.length,
        break: breakItems.length,
        track,
        cursor,
        nextCursor: hasMore ? nextCursor : null,
        hasMore,
        totalInTrack: totalCount
    }, 'Generated playlist V2');

    return {
        items,
        nextCursor: hasMore ? nextCursor : null,
        hasMore,
        track
    };
}

// ------------------------------------------------------------------
// Sub-Routines
// ------------------------------------------------------------------

/**
 * 🥪 Warmup: 3 High Stability Words (Stability > 20)
 * Mode: QUIZ (Relaxed? Or just simple?)
 * Requirement: "Easy Words", build confidence.
 * Logic: Stability desc.
 */
async function fetchWarmupItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db
): Promise<DriveItem[]> {
    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            stability: { gt: 1 }, // ✅ 降低门槛,使用相对排序
        },
        include: { vocab: true },
        orderBy: { stability: 'desc' }, // 最稳定的优先
        take: limit * 2, // 取 2 倍,确保有足够数据
    });

    // ✅ Fail-Safe: 如果没有 stability > 1 的记录,降级为任何已复习的词
    if (records.length === 0) {
        log.warn({ track }, 'No stability > 1 records, falling back to any reviewed words');
        const fallback = await client.userProgress.findMany({
            where: {
                userId,
                track,
                status: { not: 'NEW' } // 任何非新词
            },
            include: { vocab: true },
            orderBy: { last_review_at: 'desc' },
            take: limit
        });

        return fallback.map(r => ({
            ...mapToDriveItem(r.vocab, 'QUIZ', 'warmup'),
            stability: r.stability || 0.1 // 兆底默认值
        }));
    }

    // 传递真实 stability 值
    return records.slice(0, limit).map(r => ({
        ...mapToDriveItem(r.vocab, 'QUIZ', 'warmup'),
        stability: r.stability // ✅ 传入真实 stability
    }));
}

async function fetchReviewItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db,
    skipCount: number = 0
): Promise<DriveItem[]> {
    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            next_review_at: { lte: new Date() }, // Due
        },
        include: { vocab: true },
        orderBy: { next_review_at: 'asc' }, // Overdue first
        skip: skipCount,
        take: limit,
    });

    // Fallback: If no due reviews, pick Review/Mastered items
    if (records.length < limit) {
        const needed = limit - records.length;
        const extra = await client.userProgress.findMany({
            where: {
                userId,
                track,
                status: { in: ['REVIEW', 'MASTERED'] }, // No NEW
                id: { notIn: records.map(r => r.id) }
            },
            include: { vocab: true },
            orderBy: { next_review_at: 'asc' },
            take: needed
        });
        records.push(...extra);
    }

    // ✅ 传递真实 stability 值
    return records.map(r => ({
        ...mapToDriveItem(r.vocab, 'QUIZ', 'review'),
        stability: r.stability // ✅ 关键修复
    }));
}

async function fetchBreakChunks(
    userId: string,
    limit: number,
    client: Prisma.TransactionClient | typeof db = db
): Promise<DriveItem[]> {
    const vocabs = await client.vocab.findMany({
        where: {
            collocations: { not: Prisma.DbNull }
        },
        select: {
            id: true,
            collocations: true,
            word: true,
            phoneticUs: true,
            definition_cn: true,
            scenarios: true // ✅ 添加 scenarios 字段
        },
        take: 20, // Sample size
        orderBy: { frequency_score: 'desc' } // Prefer high-frequency words
    });

    if (vocabs.length === 0) {
        log.warn('No vocabs with collocations found');
        return [];
    }

    const chunks: DriveItem[] = [];

    // Flatten collocations
    for (const v of vocabs) {
        if (!v.collocations || !Array.isArray(v.collocations)) continue;

        const validCols = (v.collocations as any[]).filter((c: any) => c.text && c.text.split(' ').length > 1);

        for (const col of validCols) {
            if (chunks.length >= limit) break;

            chunks.push({
                id: `chunk-${v.id}-${Math.random()}`,
                text: col.text,
                trans: col.trans || v.definition_cn || '',
                phonetic: '',
                word: v.word,
                pos: 'phrase',
                meaning: v.definition_cn || '',
                scenarios: v.scenarios,
                stability: undefined, // WASH mode: no FSRS tracking
                mode: 'WASH',
                voice: DRIVE_VOICE_CONFIG.WASH_PHRASE,
                speed: DRIVE_VOICE_SPEED_PRESETS[DRIVE_VOICE_CONFIG.WASH_PHRASE] || 1.0 // ✅ 应用语速校准
            });
        }
        if (chunks.length >= limit) break;
    }

    log.debug({ count: chunks.length }, 'Fetched break chunks');
    return chunks;
}

// ------------------------------------------------------------------
// Mapper
// ------------------------------------------------------------------
function mapToDriveItem(v: any, mode: DriveMode, context: 'warmup' | 'review'): DriveItem {
    // Voice Strategy:
    // - Warmup: Ethan (阳光活力,建立信心)
    // - Review: Kai (磁性舒缓,适合专注)
    // Frontend will override for Quiz Answer stage (Serena温柔)

    return {
        id: v.id.toString(),
        text: v.word,
        trans: v.commonExample || v.definition_cn || 'No translation',
        phonetic: v.phoneticUs || v.phoneticUk || '',
        word: v.word,
        pos: v.partOfSpeech || 'n.',
        meaning: v.definition_cn || '',
        scenarios: v.scenarios,
        stability: undefined, // Will be populated from UserProgress if needed
        mode: mode,
        voice: context === 'warmup' ? DRIVE_VOICE_CONFIG.WARMUP : DRIVE_VOICE_CONFIG.QUIZ_QUESTION,
        speed: DRIVE_VOICE_SPEED_PRESETS[context === 'warmup' ? DRIVE_VOICE_CONFIG.WARMUP : DRIVE_VOICE_CONFIG.QUIZ_QUESTION] || 1.0 // ✅ 应用语速校准
    };
}

// ------------------------------------------------------------------
// Opus DJ Shuffle Algorithm
// 场景聚类 + 难度穿插
// ------------------------------------------------------------------

/**
 * Opus DJ Shuffle: 优化播放顺序,避免认知干扰
 * 策略:
 * 1. 难度穿插 - Easy-Hard-Hard-Easy-Chunk 模式,防止疲劳
 */
function opusDjShuffle(items: DriveItem[]): DriveItem[] {
    if (items.length === 0) return items;

    // Step 1: 按难度分层
    const easy = items.filter(i => (i.stability || 0) > 10 && i.mode === 'QUIZ');
    const hard = items.filter(i => (i.stability || 0) <= 10 && i.mode === 'QUIZ');
    const chunks = items.filter(i => i.mode === 'WASH');
    const story = items.filter(i => i.mode === 'STORY');

    log.debug({ easy: easy.length, hard: hard.length, chunks: chunks.length, story: story.length }, 'DJ Shuffle layering');

    // Step 2: 难度穿插 (三明治模式: E-H-H-E-C)
    const result: DriveItem[] = [];

    while (easy.length || hard.length || chunks.length || story.length) {
        if (easy.length) result.push(easy.shift()!);
        if (hard.length) result.push(hard.shift()!);
        if (hard.length) result.push(hard.shift()!);
        if (easy.length) result.push(easy.shift()!);
        if (chunks.length) result.push(chunks.shift()!); // Chunk 作为休息
        if (story.length) result.push(story.shift()!);
    }

    log.debug({ count: result.length }, 'DJ Shuffle result');
    return result;
}
