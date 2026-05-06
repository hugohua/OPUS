/**
 * 用户引擎偏好共享读取模块
 * 功能：
 *   供后端核心热路径按 userId 读取调度偏好，避免核心逻辑依赖 Server Action。
 */
import { db } from "@/lib/db";

export type EnginePreferences = {
    review_ratio: number;
};

export type UserSettings = {
    autoPlay?: boolean;
    hapticFeedback?: boolean;
    engine_preferences?: EnginePreferences;
};

export async function getEnginePreferencesByUserId(userId: string): Promise<EnginePreferences | undefined> {
    try {
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { settings: true },
        });
        if (!user?.settings || typeof user.settings !== "object") return undefined;
        const settings = user.settings as UserSettings;
        return settings.engine_preferences;
    } catch {
        return undefined;
    }
}
