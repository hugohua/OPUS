import { db } from "@/lib/db";

export async function getVocabTagsForUser(userId: string): Promise<string[]> {
    const rows = await db.$queryRaw<{ tag: string }[]>`
        SELECT DISTINCT jsonb_array_elements_text("masteryMatrix"->'userTags') as tag
        FROM "UserProgress"
        WHERE "userId" = ${userId} AND "masteryMatrix" ? 'userTags'
    `;

    return rows
        .map((row) => row.tag)
        .filter((tag) => tag.length > 0)
        .sort((left, right) => left.localeCompare(right));
}
