'use server';

import { auth } from "@/auth";
import { getVectorOptimizedAnchor } from "@/lib/services/anchor-engine";

export async function getWeaverAnchor(targetId: number) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const result = await getVectorOptimizedAnchor(targetId, session.user.id);
    return result;
}
