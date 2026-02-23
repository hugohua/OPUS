'use server';

/**
 * 诊断引擎 Server Action (薄壳)
 * 
 * 功能：
 *   - 为前端 DiagnosticRadar 组件提供 auth + 数据查询
 *   - 核心逻辑委托给 lib/services/diagnostic-service.ts
 */

import { auth } from '@/auth';
import {
    getUserWeaknessesRaw,
    getRadarDataRaw,
    type WeaknessProfile,
    type RadarDataPoint,
} from '@/lib/services/diagnostic-service';

// Types should be imported directly from \`@/lib/services/diagnostic-service\` in client components

/**
 * 查询用户各维度表现（带 auth 校验）
 */
export async function getUserWeaknesses(
    userId?: string,
    recentLimit = 100
): Promise<WeaknessProfile[]> {
    let uid = userId;
    if (!uid) {
        const session = await auth();
        uid = session?.user?.id;
    }
    if (!uid) return [];
    return getUserWeaknessesRaw(uid, recentLimit);
}

/**
 * 为 DiagnosticRadar 提供格式化数据（带 auth 校验）
 */
export async function getRadarData(userId?: string): Promise<{
    radarData: RadarDataPoint[];
    weakest: WeaknessProfile | null;
    totalAttempts: number;
}> {
    let uid = userId;
    if (!uid) {
        const session = await auth();
        uid = session?.user?.id;
    }
    if (!uid) return { radarData: [], weakest: null, totalAttempts: 0 };
    return getRadarDataRaw(uid);
}
