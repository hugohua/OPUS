import { db as prisma } from '@/lib/db';
import { logger } from "@/lib/logger";

// Queue Configuration
const QUEUE_CONFIG = {
    TOTAL_SLOTS: 20,
    RATIO: {
        RESCUE: 0.3, // 6 slots
        REVIEW: 0.5, // 10 slots
        NEW: 0.2     // 4 slots
    }
};

export class HybridSelector {

    /**
     * Main Entry: Select words based on the 3-level funnel
     */
    static async selectWords(userId: string) {
        logger.info({ module: "hybrid-selector", userId }, "Starting word selection (V3.0)...");

        const slots = QUEUE_CONFIG.TOTAL_SLOTS;
        // 1. Rescue Queue (Max 6)
        const rescueLimit = Math.floor(slots * QUEUE_CONFIG.RATIO.RESCUE);
        const rescueWords = await this.getRescueQueue(userId, rescueLimit);

        // 2. Review Queue (Max 10)
        let reviewLimit = Math.floor(slots * QUEUE_CONFIG.RATIO.REVIEW);
        // Bonus: If rescue queue is not full, give slots to review
        if (rescueWords.length < rescueLimit) {
            reviewLimit += (rescueLimit - rescueWords.length);
        }
        const reviewWords = await this.getReviewQueue(userId, reviewLimit, rescueWords.map(w => w.id));

        // 3. New Acquisition (Fill the rest)
        const currentCount = rescueWords.length + reviewWords.length;
        const newLimit = slots - currentCount;

        const excludeIds = [...rescueWords.map(w => w.id), ...reviewWords.map(w => w.id)];
        const newWords = await this.getNewAcquisition(userId, newLimit, excludeIds);

        logger.info({
            module: "hybrid-selector",
            counts: {
                rescue: rescueWords.length,
                review: reviewWords.length,
                new: newWords.length,
                total: rescueWords.length + reviewWords.length + newWords.length
            }
        }, "Selection complete");

        return {
            rescue: rescueWords,
            review: reviewWords,
            new: newWords,
            all: [...rescueWords, ...reviewWords, ...newWords]
        };
    }

    /**
     * Level 1: Rescue Queue
     * Condition: Logic(X) < 20 OR Visual(V) < 30
     */
    private static async getRescueQueue(userId: string, limit: number) {
        if (limit <= 0) return [];

        return await prisma.vocab.findMany({
            where: {
                progress: {
                    some: {
                        userId: userId,
                        OR: [
                            { dim_v_score: { lt: 30 } }, // Visual weak
                            { dim_x_score: { lt: 20 } }  // Logic weak
                        ]
                    }
                }
            },
            take: limit,
            orderBy: { learningPriority: 'desc' } // Prioritize core words even in rescue
        });
    }

    /**
     * Level 2: Review Queue (SRS)
     * Condition: next_review_at <= NOW
     */
    private static async getReviewQueue(userId: string, limit: number, excludeIds: number[]) {
        if (limit <= 0) return [];

        const progressItems = await prisma.userProgress.findMany({
            where: {
                userId,
                vocabId: { notIn: excludeIds },
                next_review_at: { lte: new Date() }
            },
            take: limit,
            orderBy: { next_review_at: 'asc' }, // Overdue first
            include: { vocab: true }
        });

        // Return just the vocab objects
        return progressItems.map(p => p.vocab);
    }

    /**
     * Level 3: New Acquisition (Survival Sort)
     * Sort: Verb > Freq > Length
     */
    private static async getNewAcquisition(userId: string, limit: number, excludeIds: number[]) {
        if (limit <= 0) return [];

        const excludeClause = excludeIds.length > 0
            ? `AND v.id NOT IN (${excludeIds.join(',')})`
            : '';

        try {
            // Use queryRawUnsafe but with caution. 
            // Better to strictly type the return if possible, but basic any[] is fine for now.
            // Note: We inject userId carefully.
            // For complex IN clauses, raw parameterization is tricky in Prisma ($1, $2...), 
            // so we might keep excludeIds as string if IDs are trusted (they are numbers).
            // Explicitly select columns to avoid selecting 'embedding' (vector type) which causes P2010
            return await prisma.$queryRawUnsafe<any[]>(`
                SELECT 
                    v.id, 
                    v.word, 
                    v."partOfSpeech", 
                    v."definition_cn", 
                    v."definitions", 
                    v."word_family", 
                    v."learningPriority", 
                    v."frequency_score",
                    v."is_toeic_core",
                    v."abceed_rank"
                FROM "Vocab" v
                WHERE NOT EXISTS (
                    SELECT 1 FROM "UserProgress" up 
                    WHERE up."vocabId" = v.id AND up."userId" = $1
                )
                ${excludeClause}
                ORDER BY 
                    CASE 
                        -- Priority 1: Verb (Explicit POS or Inferred from Family)
                        WHEN v."partOfSpeech" LIKE '%v.%' OR (v."word_family"->>'v' = v.word) THEN 1 
                        
                        -- Priority 2: Noun
                        WHEN v."partOfSpeech" LIKE '%n.%' OR (v."word_family"->>'n' = v.word) THEN 2
                        
                        -- Priority 3: Adjective
                        WHEN v."partOfSpeech" LIKE '%adj.%' OR (v."word_family"->>'adj' = v.word) THEN 3
                        
                        ELSE 4 
                    END ASC,
                    v.frequency_score DESC,
                    LENGTH(v.word) ASC
                LIMIT ${limit};
            `, userId);

        } catch (e) {
            logger.error({ module: "hybrid-selector", error: e }, "Failed to fetch new words");
            return [];
        }
    }
}
