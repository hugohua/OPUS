import { UserProgress } from '@/generated/prisma/client';

/**
 * 综合分 (Mastery Score) 计算引擎
 * 
 * Formula: Simple Average of 5 Dimensions
 * Scope: 0 - 100
 */
export function calculateMasteryScore(progress: Pick<UserProgress, 'dim_v_score' | 'dim_a_score' | 'dim_m_score' | 'dim_c_score' | 'dim_x_score'>): number {
    const {
        dim_v_score, // Visual / Syntax
        dim_a_score, // Audio
        dim_m_score, // Meaning
        dim_c_score, // Context / Phrase
        dim_x_score  // Logic
    } = progress;

    const total = dim_v_score + dim_a_score + dim_m_score + dim_c_score + dim_x_score;
    const average = Math.floor(total / 5);

    return Math.max(0, Math.min(100, average));
}
