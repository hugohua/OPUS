'use server';

import { db } from '@/lib/db';
import { auth } from '@/auth';
import { Prisma } from '@prisma/client';

export type VocabFilterStatus = 'ALL' | 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED' | 'LEECH' | 'CONTEXT';
export type VocabSortOption = 'RANK' | 'DUE' | 'DIFFICULTY';

interface GetVocabListParams {
    page?: number;     // 1-based
    limit?: number;    // default 50
    search?: string;
    status?: VocabFilterStatus;
    sort?: VocabSortOption;
}

export interface VocabListItem {
    id: number;
    word: string;
    phonetic: string | null;
    definition: string | null;
    abceedRank: number | null;
    fsrs: {
        status: string; // 'NEW' | 'LEARNING' | 'REVIEW' | 'MASTERED'
        stability: number;
        difficulty: number;
        retention: number; // Calculated R
        nextReview: Date | null;
        lapses: number;
        isLeech: boolean;
        hasContext: boolean;
        contextSentence: string | null;
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
        }
    };
}

/**
 * 获取 FSRS 词汇列表 (Command Center)
 */
export async function getVocabList({
    page = 1,
    limit = 50,
    search = '',
    status = 'ALL',
    sort = 'RANK'
}: GetVocabListParams): Promise<GetVocabListResponse> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }
    const userId = session.user.id;

    // 1. Build Where Clause
    const where: Prisma.VocabWhereInput = {
        // Basic Constraints
        abceed_level: { not: null }, // Only show valid vocab
    };

    // 1.1 Search (Word or Definition)
    if (search && search.trim().length > 0) {
        const keyword = search.trim();
        where.OR = [
            { word: { contains: keyword, mode: 'insensitive' } },
            { definition_cn: { contains: keyword } },
            { definition_jp: { contains: keyword } }
        ];
    }

    // 1.2 Status / Leech / Context Filter
    // This requires join with UserProgress.
    // Since we need to filter on UserProgress properties, we can't easily do a simple `include` filter in top-level `findMany` 
    // unless we strictly filter progress.
    // BUT, we want to show words even if they are 'NEW' (no progress record). 
    // Wait, PRD says "New (未学)". New words might not have a UserProgress record yet OR have status=NEW.

    // Strategy: We will query Vocab and include UserProgress.
    // However, efficient filtering on related fields in Prisma with 'OR' (entry might not exist) is tricky.
    // For "ALL", we show everything.
    // For specific statuses, verify logic below.

    const progressFilter: Prisma.UserProgressListRelationFilter = {
        some: {
            userId: userId,
            track: 'VISUAL', // Stick to VISUAL track for main inventory? PRD "Mastered Items" implies main track.
        }
    };

    if (status === 'NEW') {
        // Has NO progress OR status is NEW
        // It's hard to filter "Has NO progress" efficiently in same query as "Has progress but status NEW".
        // Simplified: Filter by "UserProgress is empty OR UserProgress.status = NEW" is hard in Prisma `where`.
        // Alternative: Fetch all (paginated) and filter in memory? No, 5000 items.

        // FIX: Let's assume for "Inventory", we mostly care about words that exist.
        // If status is NEW, we include words where progress is missing OR status is NEW.
        // Prisma `none` relation filter works for missing.
        where.AND = [
            {
                OR: [
                    { progress: { none: { userId: userId, track: 'VISUAL' } } },
                    { progress: { some: { userId: userId, track: 'VISUAL', status: 'NEW' } } }
                ]
            }
        ];
    } else if (status === 'LEARNING') {
        where.progress = {
            some: { userId: userId, track: 'VISUAL', status: 'LEARNING' }
        };
    } else if (status === 'REVIEW') {
        where.progress = {
            some: { userId: userId, track: 'VISUAL', status: 'REVIEW' }
        };
    } else if (status === 'MASTERED') {
        // Status MASTERED or Stability > 21? PRD says "Status Mastered" in Demo, but logic might vary.
        // Let's rely on the ENUM 'MASTERED' for now as per schema.
        where.progress = {
            some: { userId: userId, track: 'VISUAL', status: 'MASTERED' }
        };
    } else if (status === 'LEECH') {
        // Leech: Lapses > 3 (Example threshold)
        where.progress = {
            some: { userId: userId, track: 'VISUAL', lapses: { gte: 3 } } // Hardcoded 3 for now
        };
    } else if (status === 'CONTEXT') {
        // Has AI Context
        where.progress = {
            some: {
                userId: userId,
                track: 'VISUAL',
                lastContextSentence: { not: null } // Checks if field is set
            }
        };
    }

    // 2. Build Sort
    let orderBy: Prisma.VocabOrderByWithRelationInput | Prisma.VocabOrderByWithRelationInput[] =
        { abceed_rank: 'asc' }; // Default RANK

    if (sort === 'DUE') {
        // Sort by UserProgress.next_review_at ASC
        // Note: Words without progress naturally fall to end or need explicit null handling
        // Prisma handling of nulls in relations sort is tricky.
        // We'll try standard relation sort.
        orderBy = {
            progress: {
                _count: 'desc' // Hack? No.
                // We want to sort by the 'next_review_at' of the specific user progress.
                // Prisma doesn't support "sort by relation field with where" easily in top level `orderBy`.
                // We might need to stick to RANK for "ALL" and only allow DUE sorting if strictly filtering by progress?
                // Or we fetch and sort in memory for the current page (problematic).

                // COMPROMISE: For this implementation, allow sorting by RANK mainly. 
                // If DUE is requested, we might only check words that HAVE progress.
                // Let's try raw SQL or just stick to RANK for ALL, and DUE for Review/Learning subsets.
            }
        };
        // Revert to RANK for safety in V1, let's implement DUE sort only if simple. 
        // Prisma 5+ supports filtering in orderBy? No.
        // Let's keep RANK as primary. If sort=DUE is requested but too complex, fallback or do best effort.
        // Actually, let's try to stick to logical sorting.
        // If sort == DUE, we probably want to see "Review" list.
        // Let's trust Prisma's ability if we had a direct link, but 1-to-many makes it hard (even if unique compound).

        // Fix: UserProgress is 1-N to Vocab, but for a (User, Track) it is 1-1.
        // Prisma doesn't know it's 1-1 efficiently here without specific view.
        // We will default to RANK for now to ensure stability.
        orderBy = { abceed_rank: 'asc' };
    } else if (sort === 'DIFFICULTY') {
        // Similar issue.
        orderBy = { abceed_rank: 'asc' };
    }

    // 3. Query
    const [total, vocabs, statsResult] = await Promise.all([
        db.vocab.count({ where }),
        db.vocab.findMany({
            where,
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
            include: {
                progress: {
                    where: { userId: userId, track: 'VISUAL' },
                    take: 1
                }
            }
        }),
        // Aggregate stats (Global, not filtered by search)
        // We want global stats for the HUD
        getHudStats(userId)
    ]);

    // 4. Transform
    const items: VocabListItem[] = vocabs.map(v => {
        const p = v.progress[0]; // Can be undefined if NEW

        // Calculate Retention R = e^(ln(0.9) * (elapsed / stability))
        // This is a rough approx for display.
        // If NEW, R = 0 or 100? Let's say 0.
        let retention = 0;
        let isLeech = false;

        if (p) {
            const now = new Date().getTime();
            const lastReview = p.last_review_at ? p.last_review_at.getTime() : now;
            const elapsedDays = (now - lastReview) / (1000 * 60 * 60 * 24);
            const stability = p.stability || 0.1; // avoid div by zero
            // FSRS formula: R = (1 + factor * elapsed / s) ^ ... 
            // Simplified exp decay for visualization: R = 0.9 ^ (elapsed / stability) * 100
            // But let's use standard exp lookup or simple visual.
            // If due date is passed, R < 90%.
            // Let's use a simpler heuristic for the UI bar.
            // R = 100 if just reviewed. R drops to 90 at due date (stability).
            if (elapsedDays <= 0) retention = 100;
            else {
                // R = 0.9 ^ (elapsed / stability)
                // This matches FSRS v4 target of 90% retention at interval.
                retention = Math.pow(0.9, elapsedDays / stability) * 100;
            }

            isLeech = p.lapses >= 3 || (p.status === 'REVIEW' && p.stability < 1 && p.lapses > 1);
        }

        return {
            id: v.id,
            word: v.word,
            phonetic: v.phoneticUs || v.phoneticUk || null,
            definition: v.definition_cn || '暂无释义',
            abceedRank: v.abceed_rank,
            fsrs: {
                status: p ? p.status : 'NEW',
                stability: p?.stability ?? 0,
                difficulty: p?.difficulty ?? 0,
                retention: Math.max(0, Math.min(100, retention)),
                nextReview: p?.next_review_at ?? null,
                lapses: p?.lapses ?? 0,
                isLeech: isLeech,
                hasContext: !!p?.lastContextSentence,
                contextSentence: p?.lastContextSentence ?? null
            }
        };
    });

    return {
        items,
        metadata: {
            total,
            page,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
            stats: statsResult
        }
    };
}

async function getHudStats(userId: string) {
    // Determine counts strictly
    const [mastered, learning, due] = await Promise.all([
        db.userProgress.count({
            where: { userId, track: 'VISUAL', status: 'MASTERED' }
        }),
        db.userProgress.count({
            where: { userId, track: 'VISUAL', status: { in: ['LEARNING', 'REVIEW'] } }
        }),
        db.userProgress.count({
            where: {
                userId,
                track: 'VISUAL',
                next_review_at: { lte: new Date() },
                status: { in: ['LEARNING', 'REVIEW', 'MASTERED'] } // Mastered also needs review eventually? Typically yes in FSRS.
            }
        })
    ]);

    return { mastered, learning, due };
}
