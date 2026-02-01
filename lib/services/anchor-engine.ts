
import { prisma } from "@/lib/db";
import { UserProgress, Vocab } from "@prisma/client";

interface AnchorResult {
    word: string;
    scenario?: string;
    reason: "vector" | "fallback";
}

/**
 * 寻找 "Goldilocks Anchor" (黄金锚点)
 * 策略:
 * 1. 场景共现 (Scenario Binding)
 * 2. 也是熟词 (Status: MASTERED/REVIEW)
 * 3. 向量距离适中 (Top 3-10 to avoid too similar synonyms)
 */
export async function getVectorOptimizedAnchor(
    targetVocabId: number,
    userId: string
): Promise<AnchorResult> {
    try {
        // 1. 获取 Target 的向量与场景
        const target = await prisma.vocab.findUnique({
            where: { id: targetVocabId },
            select: {
                word: true,
                // Prisma doesn't support vector type natively yet for select, 
                // usually we need raw query if we want to read it back, 
                // but here we only need 'word' and 'scenario' metadata for valid logic.
                // Actually, to use embedding in queryRaw, we need to SELECT it first via Raw or re-use ID.
                // But since we can refer to another table column in pgvector, we can better optimize sql.
                scenarios: true
            }
        });

        if (!target) throw new Error("Target not found");

        // 2. 执行向量搜索
        // 寻找: 用户熟词 & 场景相关 & 距离最近
        // 注意: Prisma 不支持直接 Select embedding, 我们直接用 SQL 子查询 ID
        const anchors = await prisma.$queryRaw<Array<{ word: string; scenario: string; distance: number }>>`
      WITH target_vec AS (
        SELECT embedding, scenarios FROM "Vocab" WHERE id = ${targetVocabId}
      )
      SELECT 
        v.word, 
        v.scenarios, -- Raw array
        (v.embedding <=> (SELECT embedding FROM target_vec)) as distance
      FROM "Vocab" v
      JOIN "UserProgress" u ON u."vocabId" = v.id
      WHERE u."userId" = ${userId}
        AND u.status IN ('MASTERED', 'REVIEW') -- 必须是熟词
        AND v.id != ${targetVocabId}
        -- Scenario Overlap Check (Postgres Array Overlap)
        AND v.scenarios && (SELECT scenarios FROM target_vec)
      ORDER BY distance ASC
      LIMIT 10;
    `;

        // 3. Goldilocks Selection
        // 如果有足够的词，跳过前 2 个 (往往是同义词)，取第 3-5 个
        if (anchors.length > 2) {
            // Randomly pick from index 2 to min(length, 5)
            const maxIndex = Math.min(anchors.length, 5);
            const randomIndex = 2 + Math.floor(Math.random() * (maxIndex - 2));
            const selected = anchors[randomIndex];
            // Parse scenario (First matching tag)
            // Note: scenarios is string[]
            // We pick the first overlapping tag for display
            return {
                word: selected.word,
                scenario: "Business", // Simplified for now, or calculate intersection
                reason: "vector"
            };
        } else if (anchors.length > 0) {
            // 数量不足，直接取第一个
            return {
                word: anchors[0].word,
                scenario: "Business",
                reason: "vector"
            };
        }

    } catch (error) {
        console.warn("[AnchorEngine] Vector search failed or no result, falling back.", error);
    }

    // 4. Fallback: 简单的随机熟词 (High Value)
    const fallback = await prisma.userProgress.findFirst({
        where: {
            userId,
            status: { in: ['MASTERED', 'REVIEW'] },
            vocab: {
                id: { not: targetVocabId },
                learningPriority: { gt: 50 }, // Core words
            }
        },
        include: { vocab: { select: { word: true, scenarios: true } } },
        // Prisma lacks 'orderBy: random', need to pick by offset or just take latest
        orderBy: { last_review_at: 'desc' },
        take: 1
    });

    if (fallback) {
        return {
            word: fallback.vocab.word,
            scenario: fallback.vocab.scenarios[0] || "General",
            reason: "fallback"
        };
    }

    // 5. Ultimate Fallback (Mock)
    return {
        word: "Budget",
        scenario: "Finance",
        reason: "fallback"
    };
}
