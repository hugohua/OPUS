"use server";

import { auth } from "@/auth";
import {
    getWeaverIngredientsForUser,
    type WeaverIngredients,
} from "@/lib/backend-core/weaver/selection";
import { type ActionState } from "@/types/action";

export async function getWeaverIngredients(
    userId: string,
    scenario: string,
    forceRefresh = false,
    userIdOverride?: string
): Promise<ActionState<WeaverIngredients>> {
    const session = userIdOverride ? null : await auth();
    const authenticatedUserId = userIdOverride ?? session?.user?.id;
    if (!authenticatedUserId || authenticatedUserId !== userId) {
        return { status: "error", message: "Unauthorized: session mismatch" };
    }

    return getWeaverIngredientsForUser(userId, scenario, forceRefresh);
}
