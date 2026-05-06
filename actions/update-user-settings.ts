"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import {
    getEnginePreferencesByUserId as getEnginePreferencesByUserIdCore,
    type EnginePreferences,
    type UserSettings,
} from "@/lib/backend-core/settings/preferences";

// ────────────────────────────────────────
// 输入校验 (Zod)
// ────────────────────────────────────────
const EnginePreferencesSchema = z.object({
    review_ratio: z.number().min(0.1).max(1.0),
});

const UpdateSettingsSchema = z.discriminatedUnion("key", [
    z.object({ key: z.literal("autoPlay"), value: z.boolean() }),
    z.object({ key: z.literal("hapticFeedback"), value: z.boolean() }),
    z.object({ key: z.literal("engine_preferences"), value: EnginePreferencesSchema }),
]);

// ────────────────────────────────────────
// 读取用户设置
// ────────────────────────────────────────
export async function getUserSettings(): Promise<UserSettings> {
    try {
        const session = await auth();
        if (!session?.user?.id) return {};

        const user = await db.user.findUnique({
            where: { id: session.user.id },
            select: { settings: true },
        });

        if (!user?.settings || typeof user.settings !== 'object') return {};
        return user.settings as UserSettings;
    } catch {
        return {};
    }
}

// ────────────────────────────────────────
// 更新用户设置
// ────────────────────────────────────────
export async function updateUserSettings(
    input: z.infer<typeof UpdateSettingsSchema>
): Promise<{ success: boolean }> {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false };

        const parsed = UpdateSettingsSchema.parse(input);

        // 读取现有 settings
        const user = await db.user.findUnique({
            where: { id: session.user.id },
            select: { settings: true },
        });

        const currentSettings = (user?.settings && typeof user.settings === 'object')
            ? (user.settings as Record<string, unknown>)
            : {};

        // 合并更新
        const newSettings = {
            ...currentSettings,
            [parsed.key]: parsed.value,
        };

        await db.user.update({
            where: { id: session.user.id },
            data: { settings: newSettings as any },
        });
        revalidatePath('/dashboard/profile');
        revalidatePath('/dashboard/simulate');
        return { success: true };
    } catch (error) {
        console.error("[updateUserSettings] Failed:", error);
        return { success: false };
    }
}

// ────────────────────────────────────────
// 按 userId 直接读取引擎偏好 (跳过 auth，供热路径使用)
// ────────────────────────────────────────
export async function getEnginePreferencesByUserId(userId: string): Promise<EnginePreferences | undefined> {
    return getEnginePreferencesByUserIdCore(userId);
}
