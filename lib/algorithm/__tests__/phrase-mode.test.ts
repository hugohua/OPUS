
import { describe, it, expect } from 'vitest';
import { calculateImplicitGrade } from '../grading';
import { calculateMasteryScore } from '../mastery';
import { buildPhraseDrill } from '@/lib/templates/phrase-drill';
import { Vocab } from '@/generated/prisma/client';

// Mock Vocab Data
const mockVocab: Vocab = {
    id: 1,
    word: 'abandon',
    commonExample: 'abandon the car',
    definition_cn: '放弃',
    collocations: [{ text: 'completely abandon', trans: '完全放弃' }],
    // ... other required fields mock
    phoneticUs: null,
    phoneticUk: null,
    partOfSpeech: null,
    frequency_score: 0
} as unknown as Vocab;

describe('Phrase Mode Algorithms', () => {

    describe('1. Implicit Grading', () => {
        // PHRASE Mode Thresholds: Easy < 1000ms, Hard > 3000ms

        it('should return 4 (Easy) for instant response (<1000ms)', () => {
            const grade = calculateImplicitGrade(3, 500, false, 'PHRASE');
            expect(grade).toBe(4);
        });

        it('should return 3 (Good) for normal response (1000-3000ms)', () => {
            const grade = calculateImplicitGrade(3, 1500, false, 'PHRASE');
            expect(grade).toBe(3);
        });

        it('should return 2 (Hard) for slow response (>3000ms)', () => {
            const grade = calculateImplicitGrade(3, 3500, false, 'PHRASE');
            expect(grade).toBe(2);
        });

        it('should return 1 (Again) if input is 1, regardless of time', () => {
            const grade = calculateImplicitGrade(1, 100, false, 'PHRASE');
            expect(grade).toBe(1);
        });

        it('should cap at 3 (Good) on Retry, even if fast', () => {
            const grade = calculateImplicitGrade(3, 100, true, 'PHRASE');
            expect(grade).toBe(3);
        });
    });

    describe('2. Mastery Score', () => {
        it('should calculate simple average of 5 dimensions', () => {
            const progress = {
                dim_v_score: 100,
                dim_a_score: 50,
                dim_m_score: 0,
                dim_c_score: 0,
                dim_x_score: 0
            };
            // (100 + 50 + 0 + 0 + 0) / 5 = 30
            expect(calculateMasteryScore(progress)).toBe(30);
        });

        it('should handle max values', () => {
            const progress = {
                dim_v_score: 100,
                dim_a_score: 100,
                dim_m_score: 100,
                dim_c_score: 100,
                dim_x_score: 100
            };
            expect(calculateMasteryScore(progress)).toBe(100);
        });
    });

    describe('3. Template Builder (Phrase Drill)', () => {
        it('should prefer collocations if available', () => {
            const result = buildPhraseDrill(mockVocab);
            expect(result).not.toBeNull();
            expect(result?.meta?.source).toBe('db_collocation');

            // Check content (Regex Highlight)
            const textSeg = result?.segments.find(s => s.type === 'text');
            expect(textSeg?.content_markdown).toContain('**abandon**'); // Highlighted
            expect(textSeg?.content_markdown).toContain('completely'); // Context
        });

        it('should fallback to commonExample if collocations empty', () => {
            const fallbackVocab = { ...mockVocab, collocations: [] };
            const result = buildPhraseDrill(fallbackVocab);

            expect(result).not.toBeNull();
            const textSeg = result?.segments.find(s => s.type === 'text');
            expect(textSeg?.content_markdown).toContain('**abandon** the car');
        });

        it('should return null if no context available', () => {
            const emptyVocab = { ...mockVocab, collocations: [], commonExample: null };
            const result = buildPhraseDrill(emptyVocab);
            expect(result).toBeNull();
        });
    });

});
