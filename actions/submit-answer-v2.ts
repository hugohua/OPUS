'use server';

/**
 * [V2.0] 五维记忆系统 - 原子提交 API
 * 
 * 功能：
 *   1. 隐式评分 (时间 → Grade)
 *   2. 题型权重修正 (S_V_O Easy → Good)
 *   3. 写 Redis 活跃窗口缓冲
 *   4. 写 StudyLog 流水
 *   5. 错题注入队列 (3分钟后复现)
 *   6. 更新 active_sessions (Worker 扫表用)
 */

import { db } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import {
    DrillType,
    DimensionCode,
    DRILL_TYPE_TO_DIMENSION
} from '@/types/briefing';
import { redis } from '@/lib/queue/connection';

const log = createLogger('actions:submit-answer-v2');

// ============================================
// Redis Key Schema
// ============================================
const redisKeys = {
    window: (userId: string, vocabId: number) => `window:${userId}:${vocabId}`,
    activeSessions: 'active_sessions',
    injection: (userId: string) => `injection:${userId}`,
};

// ============================================
// Types
// ============================================
interface SubmitAnswerInput {
    userId: string;
    vocabId: number;
    drillType: DrillType;
    isPass: boolean;
    timeSpent: number; // 毫秒
    isRetry?: boolean;
}

interface SubmitAnswerResult {
    grade: number;
    dimension: DimensionCode;
    needsInjection: boolean;
}

// ============================================
// Main API: submitAnswerV2
// ============================================
export async function submitAnswerV2(
    input: SubmitAnswerInput
): Promise<ActionState<SubmitAnswerResult>> {
    try {
        const { userId, vocabId, drillType, isPass, timeSpent, isRetry } = input;

        log.info({ userId, vocabId, drillType, isPass, timeSpent }, '[V2] Submitting answer');

        // ============================================
        // Step 1: 隐式评分 (时间 → Grade)
        // ============================================
        let grade = calculateGrade(isPass, timeSpent, isRetry);
        log.info({ userId, vocabId, isPass, timeSpent, grade }, '[V2][Step1] 隐式评分计算完成');

        // ============================================
        // Step 2: 题型权重修正
        // ============================================
        const originalGrade = grade;
        grade = applyDrillTypeWeight(grade, drillType);
        if (grade !== originalGrade) {
            log.info({ userId, drillType, originalGrade, newGrade: grade }, '[V2][Step2] 题型权重修正');
        }

        const dimension = DRILL_TYPE_TO_DIMENSION[drillType];

        // ============================================
        // Step 3: 写 Redis 活跃窗口缓冲
        // ============================================
        await updateWindowBuffer(userId, vocabId, grade, isPass);
        log.info({ userId, vocabId, grade }, '[V2][Step3] Redis 窗口缓冲已更新');

        // ============================================
        // Step 4: 写 StudyLog 流水
        // ============================================
        await db.studyLog.create({
            data: {
                userId,
                vocabId,
                drillType,
                dimension,
                result: isPass ? 'PASS' : 'FAIL',
                timeSpent,
                grade
            }
        });
        log.info({ userId, vocabId, result: isPass ? 'PASS' : 'FAIL' }, '[V2][Step4] StudyLog 已写入');

        // ============================================
        // Step 5: 错题注入 (如果答错)
        // ============================================
        let needsInjection = false;
        if (!isPass) {
            log.info({ userId, vocabId }, '[V2][Step5] ⚠️ 答错，触发错题注入...');
            await injectErrorDrill(userId, vocabId, drillType);
            needsInjection = true;
        } else {
            log.info({ userId, vocabId }, '[V2][Step5] 答对，无须注入');
        }

        // ============================================
        // Step 6: 更新维度分数 (即时反馈)
        // ============================================
        await updateDimensionScore(userId, vocabId, dimension, isPass);
        log.info({ userId, vocabId, dimension, scoreChange: isPass ? '+5' : '-5' }, '[V2][Step6] 维度分数已更新');

        return {
            status: 'success',
            message: 'Answer submitted',
            data: { grade, dimension, needsInjection }
        };

    } catch (error: any) {
        log.error({ error }, '[V2] submitAnswerV2 failed');
        return {
            status: 'error',
            message: error.message || 'Failed to submit answer'
        };
    }
}

// ============================================
// Helper: 隐式评分
// ============================================
function calculateGrade(isPass: boolean, timeSpent: number, isRetry?: boolean): number {
    if (!isPass) return 1; // Again

    if (isRetry) return 3; // 重试最多算 Good

    if (timeSpent < 1500) return 4;       // Easy (< 1.5s)
    if (timeSpent > 5000) return 2;       // Hard (> 5s)
    return 3;                              // Good (1.5s - 5s)
}

// ============================================
// Helper: 题型权重修正
// ============================================
function applyDrillTypeWeight(grade: number, drillType: DrillType): number {
    // S_V_O 是最简单的题型，Easy 降为 Good
    if (drillType === 'S_V_O' && grade === 4) {
        return 3;
    }

    // 可扩展：PART5_CLOZE 可以加 Bonus
    // if (drillType === 'PART5_CLOZE' && grade === 3) {
    //     return 4; // Good → Easy (Bonus)
    // }

    return grade;
}

// ============================================
// Helper: 更新窗口缓冲
// ============================================
async function updateWindowBuffer(
    userId: string,
    vocabId: number,
    grade: number,
    isPass: boolean
) {
    const key = redisKeys.window(userId, vocabId);
    const now = Date.now();

    // 获取现有窗口数据
    const existing = await redis.hgetall(key);

    const attempts = parseInt(existing.attempts || '0') + 1;
    const hasAgain = existing.hasAgain === 'true' || !isPass;

    // 更新窗口
    await redis.hset(key, {
        lastGrade: grade.toString(),
        attempts: attempts.toString(),
        hasAgain: hasAgain.toString(),
        updatedAt: now.toString()
    });

    // 设置 TTL (1小时防止意外删除)
    await redis.expire(key, 3600);

    // 更新 active_sessions (Worker 扫表用)
    await redis.zadd(redisKeys.activeSessions, now, userId);
}

// ============================================
// Helper: 注入错题
// ============================================
async function injectErrorDrill(
    userId: string,
    vocabId: number,
    failedType: DrillType
) {
    const key = redisKeys.injection(userId);
    const injectAt = Date.now() + 3 * 60 * 1000; // 3分钟后

    // 选择换一个维度的题型 (降维打击)
    const alternativeType = selectAlternativeType(failedType);

    // 构建注入数据 (简化版，实际消费时重新取)
    const injectionPayload = JSON.stringify({
        vocabId,
        drillType: alternativeType,
        source: 'injection',
        injectedAt: Date.now()
    });

    await redis.zadd(key, injectAt, injectionPayload);

    log.info({ userId, vocabId, failedType, alternativeType, injectAt }, '[V2][Helper] ✅ 错题已注入 Redis 队列 (延迟3分钟)');
}

// ============================================
// Helper: 选择替代题型 (降维打击)
// ============================================
function selectAlternativeType(failedType: DrillType): DrillType {
    // 降维顺序: PART5_CLOZE → VISUAL_TRAP → S_V_O
    const hierarchy: DrillType[] = ['PART5_CLOZE', 'VISUAL_TRAP', 'S_V_O'];
    const idx = hierarchy.indexOf(failedType);

    if (idx < 0 || idx >= hierarchy.length - 1) {
        return 'S_V_O'; // 最简单
    }

    return hierarchy[idx + 1];
}

// ============================================
// Helper: 更新维度分数
// ============================================
async function updateDimensionScore(
    userId: string,
    vocabId: number,
    dimension: DimensionCode,
    isPass: boolean
) {
    const fieldMap: Record<DimensionCode, string> = {
        CTX: 'dim_ctx_score',
        VIS: 'dim_vis_score',
        MEA: 'dim_mea_score',
        AUD: 'dim_aud_score',
        LOG: 'dim_log_score'
    };

    const field = fieldMap[dimension];
    const change = isPass ? 5 : -5; // +5/-5 per action

    // 先获取当前值
    const progress = await db.userProgress.findUnique({
        where: { userId_vocabId: { userId, vocabId } },
        select: { [field]: true }
    });

    const currentScore = (progress as any)?.[field] ?? 0;
    const newScore = Math.max(0, Math.min(100, currentScore + change));

    // 更新 (upsert)
    await db.userProgress.upsert({
        where: { userId_vocabId: { userId, vocabId } },
        update: {
            [field]: newScore,
            last_dim_tested: dimension
        },
        create: {
            userId,
            vocabId,
            [field]: newScore,
            last_dim_tested: dimension
        }
    });
}
