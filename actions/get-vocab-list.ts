'use server';

import { auth } from "@/auth";
import {
    getVocabListForUser,
    type GetVocabListParams,
    type GetVocabListResponse,
} from "@/lib/backend-core/vocabulary/list";

export async function getVocabList(params: GetVocabListParams = {}): Promise<GetVocabListResponse> {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
        throw new Error("Unauthorized");
    }

    return getVocabListForUser(userId, params);
}
