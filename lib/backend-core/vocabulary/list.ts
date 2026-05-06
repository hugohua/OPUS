import { type Prisma } from "@prisma/client";

import { LEECH_THRESHOLD } from "@/config/vocab";
import { db } from "@/lib/db";
import { buildNotMasteredVocabWhere } from "@/lib/vocab-state/filters";

export type VocabFilterStatus =
    | "ALL"
    | "NEW"
    | "LEARNING"
    | "REVIEW"
    | "MASTERED"
    | "LEECH"
    | "CONTEXT"
    | "TAGGED"
    | "FAVORITE";

export type VocabSortOption = "RANK" | "DUE" | "DIFFICULTY";

export interface GetVocabListParams {
    page?: number;
    limit?: number;
    search?: string;
    status?: VocabFilterStatus;
    sort?: VocabSortOption;
    tagFilter?: string;
}

export interface VocabListItem {
    id: number;
    word: string;
    phonetic: string | null;
    definition: string | null;
    abceedRank: number | null;
    fsrs: {
        status: string;
        stability: number;
        difficulty: number;
        retention: number;
        nextReview: Date | null;
        lapses: number;
        isLeech: boolean;
        hasContext: boolean;
        contextSentence: string | null;
        isFavorite: boolean;
    };
}

export interface GetVocabListResponse {
    items: VocabListItem[];
    metadata: {
        total: number;
        page: number;
        totalPages: number;
        hasMore: boolean;
        stats: {
            mastered: number;
            learning: number;
            due: number;
            totalVocab: number;
        };
    };
}

export async function getVocabListForUser(
    userId: string,
    {
        page = 1,
        limit = 50,
        search = "",
        status = "ALL",
        sort = "RANK",
        tagFilter,
    }: GetVocabListParams = {}
): Promise<GetVocabListResponse> {
    const where: Prisma.VocabWhereInput = {
        abceed_level: { not: null },
    };

    if (search && search.trim().length > 0) {
        const keyword = search.trim();
        where.OR = [
            { word: { contains: keyword, mode: "insensitive" } },
            { definition_cn: { contains: keyword } },
            { definition_jp: { contains: keyword } },
        ];
    }

    const appendWhereAnd = (condition: Prisma.VocabWhereInput) => {
        const current = where.AND;
        const currentArray = Array.isArray(current) ? current : current ? [current] : [];
        where.AND = [...currentArray, condition];
    };

    if (!["ALL", "MASTERED", "FAVORITE"].includes(status)) {
        appendWhereAnd(buildNotMasteredVocabWhere(userId));
    }

    if (status === "NEW") {
        appendWhereAnd({
            OR: [
                { progress: { none: { userId, track: "VISUAL" } } },
                { progress: { some: { userId, track: "VISUAL", status: "NEW" } } },
            ],
        });
    } else if (status === "LEARNING") {
        where.progress = {
            some: { userId, track: "VISUAL", status: "LEARNING" },
        };
    } else if (status === "REVIEW") {
        where.progress = {
            some: {
                userId,
                track: "VISUAL",
                next_review_at: { lte: new Date() },
                status: { not: "NEW" },
            },
        };
    } else if (status === "MASTERED") {
        where.userVocabStates = {
            some: { userId, status: "MASTERED" },
        };
    } else if (status === "FAVORITE") {
        where.userVocabStates = {
            some: { userId, isFavorite: true },
        };
    } else if (status === "LEECH") {
        where.progress = {
            some: { userId, track: "VISUAL", lapses: { gte: LEECH_THRESHOLD } },
        };
    } else if (status === "CONTEXT") {
        where.progress = {
            some: {
                userId,
                track: "VISUAL",
                lastContextSentence: { not: null },
            },
        };
    } else if (status === "TAGGED" && tagFilter) {
        where.progress = {
            some: {
                userId,
                track: "VISUAL",
                masteryMatrix: {
                    path: ["userTags"],
                    array_contains: tagFilter,
                },
            },
        };
    }

    let orderBy: Prisma.VocabOrderByWithRelationInput | Prisma.VocabOrderByWithRelationInput[] = {
        abceed_rank: "asc",
    };

    if (sort === "DUE" || sort === "DIFFICULTY") {
        orderBy = { abceed_rank: "asc" };
    }

    const [total, vocabs, statsResult] = await Promise.all([
        db.vocab.count({ where }),
        db.vocab.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
            include: {
                progress: {
                    where: { userId, track: "VISUAL" },
                    take: 1,
                },
                userVocabStates: {
                    where: { userId },
                    take: 1,
                },
            },
        }),
        getHudStats(userId),
    ]);

    const items: VocabListItem[] = vocabs.map((vocab) => {
        const progress = vocab.progress[0];
        const userState = vocab.userVocabStates[0];
        const isWordMastered = userState?.status === "MASTERED";

        let retention = 0;
        let isLeech = false;

        if (progress) {
            const now = new Date().getTime();
            const lastReview = progress.last_review_at ? progress.last_review_at.getTime() : now;
            const elapsedDays = (now - lastReview) / (1000 * 60 * 60 * 24);
            const stability = progress.stability || 0.1;
            retention = elapsedDays <= 0 ? 100 : Math.pow(0.9, elapsedDays / stability) * 100;
            isLeech = progress.lapses >= LEECH_THRESHOLD
                || (progress.status === "REVIEW" && progress.stability < 1 && progress.lapses > 1);
        }

        return {
            id: vocab.id,
            word: vocab.word,
            phonetic: vocab.phoneticUs || vocab.phoneticUk || null,
            definition: vocab.definition_cn || "暂无释义",
            abceedRank: vocab.abceed_rank,
            fsrs: {
                status: isWordMastered ? "MASTERED" : progress ? progress.status : "NEW",
                stability: progress?.stability ?? 0,
                difficulty: progress?.difficulty ?? 0,
                retention: Math.max(0, Math.min(100, retention)),
                nextReview: progress?.next_review_at ?? null,
                lapses: progress?.lapses ?? 0,
                isLeech,
                hasContext: !!progress?.lastContextSentence,
                contextSentence: progress?.lastContextSentence ?? null,
                isFavorite: userState?.isFavorite ?? false,
            },
        };
    });

    return {
        items,
        metadata: {
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
            stats: statsResult,
        },
    };
}

async function getHudStats(userId: string) {
    const [mastered, learning, due, totalVocab] = await Promise.all([
        db.userVocabState.count({
            where: { userId, status: "MASTERED" },
        }),
        db.userProgress.count({
            where: {
                userId,
                track: "VISUAL",
                status: { in: ["LEARNING", "REVIEW"] },
                vocab: buildNotMasteredVocabWhere(userId),
            },
        }),
        db.userProgress.count({
            where: {
                userId,
                track: "VISUAL",
                next_review_at: { lte: new Date() },
                status: { in: ["LEARNING", "REVIEW"] },
                vocab: buildNotMasteredVocabWhere(userId),
            },
        }),
        db.vocab.count({
            where: { abceed_level: { not: null } },
        }),
    ]);

    return { mastered, learning, due, totalVocab };
}
