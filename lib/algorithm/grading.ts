import { SessionMode } from '@/types/briefing';
import { createSessionModeRecord } from '@/lib/config/mixed-mode-config';

interface TimeThresholds {
    easy: number; // 毫秒：低于此时间视为"容易" (Easy/4分)
    hard: number; // 毫秒：高于此时间视为"困难" (Hard/2分)
}

// 可配置的时间阈值 (单位: 毫秒)
// 用于根据用户的答题速度自动调整 FSRS 评分
const baseThresholds = createSessionModeRecord<TimeThresholds>({
    // Phrase Mode: 快速反应 (扫描与回忆)
    PHRASE: { easy: 1000, hard: 3000 },

    // Syntax Mode: 需要语法分析
    SYNTAX: { easy: 2500, hard: 8000 },

    // Context Mode: 需要深度阅读理解 (L2)
    CONTEXT: { easy: 5000, hard: 15000 },

    // 兜底配置
    CHUNKING: { easy: 1500, hard: 5000 },
    NUANCE: { easy: 1500, hard: 5000 },
    BLITZ: { easy: 1500, hard: 5000 },
    AUDIO: { easy: 1500, hard: 5000 },
    READING: { easy: 1500, hard: 5000 },
    VISUAL: { easy: 1500, hard: 5000 },
});

export const GRADING_THRESHOLDS: Record<SessionMode | 'DEFAULT', TimeThresholds> = {
    ...baseThresholds,
    DEFAULT: { easy: 1500, hard: 5000 }
};

/**
 * 计算隐式 FSRS 评分
 * 基于用户输入结果 + 答题时间 + 模式配置
 * 
 * @param inputGrade - UI 传入的评分：1 (忘记/错误) 或 3 (认识/正确)
 * @param duration - 答题耗时 (毫秒)
 * @param isRetry - 是否为重试（错误后修正）
 * @param mode - 当前会话模式
 * @returns FSRS 评分 (1-4)
 */
export function calculateImplicitGrade(
    inputGrade: number,
    duration: number,
    isRetry: boolean,
    mode: SessionMode
): number {
    // 1. 显式"忘记"或错误，永远记为 1 分 (Again)
    if (inputGrade === 1) return 1;

    // 2. 重试修正，强制记为 3 分 (Good)
    // 防止对短期记忆的修正被误判为高稳定性
    if (isRetry) return 3;

    // 3. 基于时间的隐式评分梯度
    // 用户虽然答对了（inputGrade=3），但我们会根据耗时微调 FSRS 评分
    const config = GRADING_THRESHOLDS[mode] || GRADING_THRESHOLDS.DEFAULT;

    // 答得非常快 -> 容易 (Easy/4分) -> 下次复习间隔会大幅延长
    if (duration < config.easy) return 4;

    // 答得很慢 -> 困难 (Hard/2分) -> 下次复习间隔会缩短
    if (duration > config.hard) return 2;

    // 正常速度 -> 良好 (Good/3分) -> 标准复习间隔
    return 3;
}
