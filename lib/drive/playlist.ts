import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { getStratifiedNewWords } from '@/lib/services/omps-core';
import { mapToDriveItem } from '@/lib/utils/drive-mapper';
import {
    DRIVE_VOICE_CONFIG,
    DRIVE_VOICE_SPEED_PRESETS,
    type DriveItem,
    type DrivePlaylistOptions,
    type DrivePlaylistResponse,
    type DriveTrack,
} from '@/lib/constants/drive';
import {
    DEFAULT_BATCH_SIZE,
    REVIEW_MODES,
    type ReviewModeId,
} from '@/lib/constants/review-modes';
import { buildNotMasteredVocabWhere } from '@/lib/vocab-state/filters';

const log = createLogger('drive:playlist');

export async function generateDrivePlaylistForUser(
    userId: string,
    options: DrivePlaylistOptions = {}
): Promise<DrivePlaylistResponse> {
    const track: DriveTrack = options.track || 'VISUAL';
    const mode: ReviewModeId = options.mode || 'SANDWICH';
    const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
    const config = REVIEW_MODES[mode];

    const warmupCount = Math.round(batchSize * config.slots.warmup);
    const weakCount = Math.round(batchSize * config.slots.weak);
    const newWordCount = Math.round(batchSize * config.slots.newWord);
    const phraseCount = Math.round(batchSize * config.slots.phrase);
    const reviewCount = batchSize - warmupCount - weakCount - newWordCount - phraseCount;

    log.info({ userId, track, mode, batchSize, warmupCount, reviewCount, weakCount, newWordCount, phraseCount }, 'Generating playlist V3');

    const fetchResults = await db.$transaction(async (tx) => {
        const results: DriveItem[] = [];
        const seenVocabIds = new Set<number>();

        if (warmupCount > 0) {
            const items = await fetchWarmupItems(userId, warmupCount, track, tx);
            rememberSeenIds(items, seenVocabIds);
            results.push(...items);
        }

        if (reviewCount > 0) {
            const items = await fetchReviewItems(userId, reviewCount, track, tx, seenVocabIds);
            rememberSeenIds(items, seenVocabIds);
            results.push(...items);
        }

        if (weakCount > 0) {
            const items = await fetchWeakItems(userId, weakCount, track, tx, seenVocabIds);
            rememberSeenIds(items, seenVocabIds);
            results.push(...items);
        }

        if (newWordCount > 0) {
            results.push(...await fetchNewWords(userId, newWordCount, seenVocabIds));
        }

        if (phraseCount > 0) {
            results.push(...await fetchBreakChunks(userId, phraseCount, tx, seenVocabIds));
        }

        return results;
    });

    const items = opusDjShuffle(fetchResults);

    log.info({ total: items.length, mode, batchSize, track }, 'Generated playlist V3');

    return { items, track, mode };
}

function rememberSeenIds(items: DriveItem[], seenVocabIds: Set<number>) {
    for (const item of items) {
        const id = Number.parseInt(item.id, 10);
        if (!Number.isNaN(id)) {
            seenVocabIds.add(id);
        }
    }
}

async function fetchWarmupItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db
): Promise<DriveItem[]> {
    const poolSize = Math.max(limit * 5, 30);
    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            stability: { gt: 1 },
            vocab: buildNotMasteredVocabWhere(userId),
        },
        include: { vocab: true },
        orderBy: { stability: 'desc' },
        take: poolSize,
    });

    if (records.length === 0) {
        log.warn({ track }, 'No stability > 1 records, falling back to any reviewed words');
        const fallback = await client.userProgress.findMany({
            where: {
                userId,
                track,
                status: { not: 'NEW' },
                vocab: buildNotMasteredVocabWhere(userId),
            },
            include: { vocab: true },
            orderBy: { last_review_at: 'desc' },
            take: limit,
        });

        return shuffleArray(fallback).slice(0, limit).map((record) => ({
            ...mapToDriveItem(record.vocab, 'QUIZ', 'warmup'),
            stability: record.stability || 0.1,
        }));
    }

    return shuffleArray(records).slice(0, limit).map((record) => ({
        ...mapToDriveItem(record.vocab, 'QUIZ', 'warmup'),
        stability: record.stability,
    }));
}

async function fetchReviewItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db,
    excludeIds: Set<number> = new Set()
): Promise<DriveItem[]> {
    const excludeArray = Array.from(excludeIds);

    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            next_review_at: { lte: new Date() },
            ...(excludeArray.length > 0 ? { vocabId: { notIn: excludeArray } } : {}),
            vocab: buildNotMasteredVocabWhere(userId),
        },
        include: { vocab: true },
        orderBy: { next_review_at: 'asc' },
        take: limit,
    });

    if (records.length < limit) {
        const needed = limit - records.length;
        const existingIds = [...excludeArray, ...records.map((record) => record.vocabId)];
        const pool = await client.userProgress.count({
            where: {
                userId,
                track,
                status: 'REVIEW',
                vocabId: { notIn: existingIds },
                vocab: buildNotMasteredVocabWhere(userId),
            },
        });
        const maxSkip = Math.max(0, pool - needed);
        const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

        const extra = await client.userProgress.findMany({
            where: {
                userId,
                track,
                status: 'REVIEW',
                vocabId: { notIn: existingIds },
                vocab: buildNotMasteredVocabWhere(userId),
            },
            include: { vocab: true },
            orderBy: { next_review_at: 'asc' },
            skip: randomSkip,
            take: needed,
        });
        records.push(...extra);
    }

    return records.map((record) => ({
        ...mapToDriveItem(record.vocab, 'QUIZ', 'review'),
        stability: record.stability,
    }));
}

async function fetchWeakItems(
    userId: string,
    limit: number,
    track: DriveTrack,
    client: Prisma.TransactionClient | typeof db = db,
    excludeIds: Set<number> = new Set()
): Promise<DriveItem[]> {
    const excludeArray = Array.from(excludeIds);

    const records = await client.userProgress.findMany({
        where: {
            userId,
            track,
            status: { not: 'NEW' },
            ...(excludeArray.length > 0 ? { vocabId: { notIn: excludeArray } } : {}),
            vocab: buildNotMasteredVocabWhere(userId),
        },
        include: { vocab: true },
        orderBy: { stability: 'asc' },
        take: limit,
    });

    return records.map((record) => ({
        ...mapToDriveItem(record.vocab, 'QUIZ', 'review'),
        stability: record.stability,
    }));
}

async function fetchNewWords(
    userId: string,
    limit: number,
    excludeIds: Set<number> = new Set()
): Promise<DriveItem[]> {
    try {
        const candidates = await getStratifiedNewWords(userId, limit, Array.from(excludeIds));

        return candidates.map((candidate) => ({
            ...mapToDriveItem({
                id: candidate.vocabId,
                word: candidate.word,
                definition_cn: candidate.definition_cn,
                phoneticUs: candidate.phoneticUs || null,
                commonExample: candidate.commonExample,
                scenarios: [],
                frequency_score: candidate.frequency_score,
            } as any, 'QUIZ', 'review'),
            stability: 0,
        }));
    } catch (error) {
        log.error({ error }, 'Failed to fetch new words for DISCOVERY mode');
        return [];
    }
}

async function fetchBreakChunks(
    userId: string,
    limit: number,
    client: Prisma.TransactionClient | typeof db = db,
    excludeIds: Set<number> = new Set()
): Promise<DriveItem[]> {
    const totalWithCollocations = await client.vocab.count({
        where: {
            ...buildNotMasteredVocabWhere(userId),
            collocations: { not: Prisma.DbNull },
            ...(excludeIds.size > 0 ? { id: { notIn: Array.from(excludeIds) } } : {}),
        },
    });
    const sampleSize = Math.min(20, totalWithCollocations);
    const maxSkip = Math.max(0, totalWithCollocations - sampleSize);
    const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

    const vocabs = await client.vocab.findMany({
        where: {
            ...buildNotMasteredVocabWhere(userId),
            collocations: { not: Prisma.DbNull },
            ...(excludeIds.size > 0 ? { id: { notIn: Array.from(excludeIds) } } : {}),
        },
        select: {
            id: true,
            collocations: true,
            word: true,
            phoneticUs: true,
            definition_cn: true,
            scenarios: true,
        },
        skip: randomSkip,
        take: sampleSize,
        orderBy: { frequency_score: 'desc' },
    });

    if (vocabs.length === 0) {
        log.warn('No vocabs with collocations found');
        return [];
    }

    const allChunks: DriveItem[] = [];
    for (const vocab of vocabs) {
        if (!vocab.collocations || !Array.isArray(vocab.collocations)) continue;

        const validCollocations = (vocab.collocations as any[]).filter(
            (collocation) => collocation.text && collocation.text.split(' ').length > 1
        );

        for (const collocation of validCollocations) {
            allChunks.push({
                id: `chunk-${vocab.id}-${Math.random()}`,
                text: collocation.text,
                trans: collocation.trans || vocab.definition_cn || '暂无翻译',
                phonetic: '',
                word: vocab.word,
                ttsPhrase: collocation.text,
                pos: 'phrase',
                meaning: vocab.definition_cn || '',
                scenarios: vocab.scenarios,
                stability: undefined,
                mode: 'WASH',
                voice: DRIVE_VOICE_CONFIG.WASH_PHRASE,
                speed: DRIVE_VOICE_SPEED_PRESETS[DRIVE_VOICE_CONFIG.WASH_PHRASE] || 1.0,
            });
        }
    }

    return shuffleArray(allChunks).slice(0, limit);
}

function opusDjShuffle(items: DriveItem[]): DriveItem[] {
    if (items.length === 0) return items;

    const easy = items.filter((item) => (item.stability || 0) > 10 && item.mode === 'QUIZ');
    const hard = items.filter((item) => (item.stability || 0) <= 10 && item.mode === 'QUIZ');
    const chunks = items.filter((item) => item.mode === 'WASH');
    const story = items.filter((item) => item.mode === 'STORY');
    const result: DriveItem[] = [];

    log.debug({ easy: easy.length, hard: hard.length, chunks: chunks.length, story: story.length }, 'DJ Shuffle layering');

    while (easy.length || hard.length || chunks.length || story.length) {
        if (easy.length) result.push(easy.shift()!);
        if (hard.length) result.push(hard.shift()!);
        if (hard.length) result.push(hard.shift()!);
        if (easy.length) result.push(easy.shift()!);
        if (chunks.length) result.push(chunks.shift()!);
        if (story.length) result.push(story.shift()!);
    }

    log.debug({ count: result.length }, 'DJ Shuffle result');
    return result;
}

function shuffleArray<T>(arr: T[]): T[] {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
}
