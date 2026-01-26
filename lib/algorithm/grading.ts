import { SessionMode } from '@/types/briefing';

interface TimeThresholds {
    easy: number; // < This = Easy
    hard: number; // > This = Hard
}

// Configurable Time Thresholds (ms)
export const GRADING_THRESHOLDS: Record<SessionMode | 'DEFAULT', TimeThresholds> = {
    // Phrase Mode: Rapid fire (Scan & Recall)
    PHRASE: { easy: 1000, hard: 3000 },

    // Syntax Mode: Analysis required
    SYNTAX: { easy: 2500, hard: 8000 },

    // Default (Fallbacks)
    DEFAULT: { easy: 1500, hard: 5000 },
    CHUNKING: { easy: 1500, hard: 5000 },
    NUANCE: { easy: 1500, hard: 5000 },
    BLITZ: { easy: 1500, hard: 5000 },
    AUDIO: { easy: 1500, hard: 5000 }, // Placeholder
    READING: { easy: 1500, hard: 5000 }, // Placeholder
    VISUAL: { easy: 1500, hard: 5000 }, // Placeholder
};

/**
 * Calculate FSRS Grade based on User Input + Time + Config
 * 
 * @param inputGrade - 1 (Fail) or 3 (Pass) from UI
 * @param duration - Processing time in ms
 * @param isRetry - Is this a retry of a failed card?
 * @param mode - Current session mode
 */
export function calculateImplicitGrade(
    inputGrade: number,
    duration: number,
    isRetry: boolean,
    mode: SessionMode
): number {
    // 1. Fail is always Fail (1)
    if (inputGrade === 1) return 1;

    // 2. Retry Cap -> Force Good (3)
    // Prevent over-estimating stability on immediate corrections
    if (isRetry) return 3;

    // 3. Time-based Gradient
    const config = GRADING_THRESHOLDS[mode] || GRADING_THRESHOLDS.DEFAULT;

    if (duration < config.easy) return 4; // Easy
    if (duration > config.hard) return 2; // Hard

    return 3; // Good
}
