'use server';

import { auth } from "@/auth";
import { getVocabDetailForUser } from "@/lib/backend-core/vocabulary/detail";

export async function getVocabDetail(identifier: number | string) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
        throw new Error("Unauthorized");
    }

    return getVocabDetailForUser(userId, identifier);
}
