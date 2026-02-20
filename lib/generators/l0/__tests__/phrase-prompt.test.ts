/**
 * L0 Phrase Generator - Prompt Format Guard Tests
 * 确保 Phrase Prompt 符合 Array-First 规范（prompt-structure-v2.md §6）
 */

import { describe, it, expect } from 'vitest';
import { L0_PHRASE_SYSTEM_PROMPT, getL0PhraseBatchPrompt } from '../phrase';

describe('L0 Phrase Prompt Format Guard', () => {

    it('should NOT contain { "drills": [...] } wrapper (Array-First spec)', () => {
        // Ensure the prompt never instructs LLM to use the banned "drills" key
        expect(L0_PHRASE_SYSTEM_PROMPT).not.toContain('"drills"');
    });

    it('should instruct LLM to return raw JSON array without wrapping', () => {
        expect(L0_PHRASE_SYSTEM_PROMPT).toContain('Return raw JSON array');
        expect(L0_PHRASE_SYSTEM_PROMPT).toContain('NO outer object wrapper');
        expect(L0_PHRASE_SYSTEM_PROMPT).not.toContain('"items"');
    });

    it('should contain required BriefingPayload fields', () => {
        expect(L0_PHRASE_SYSTEM_PROMPT).toContain('"mode": "PHRASE"');
        expect(L0_PHRASE_SYSTEM_PROMPT).toContain('"type": "text"');
        expect(L0_PHRASE_SYSTEM_PROMPT).toContain('"type": "interaction"');
        expect(L0_PHRASE_SYSTEM_PROMPT).toContain('"style": "bubble_select"');
    });

    it('should generate valid prompt structure', () => {
        const prompt = getL0PhraseBatchPrompt([
            { targetWord: 'relevant', modifiers: ['highly'] }
        ]);

        expect(prompt.system).toBe(L0_PHRASE_SYSTEM_PROMPT);
        expect(prompt.user).toContain('"targetWord":"relevant"');
    });

});
