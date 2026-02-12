"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

// ────────────────────────────────────────
// 输入校验 (Zod)
// ────────────────────────────────────────
const UpdateSettingsSchema = z.object({
    key: z.enum(["autoPlay", "hapticFeedback"]),
    value: z.boolean(),
});

export type UserSettings = {
    autoPlay?: boolean;
    hapticFeedback?: boolean;
};

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
        return { success: true };
    } catch (error) {
        console.error("[updateUserSettings] Failed:", error);
        return { success: false };
    }
}
