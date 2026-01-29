/**
 * Generator: L0 / Phrase (1+N Expansion)
 * 场景: 核心词拓展 (Modifiers)
 */

export interface PhraseGeneratorInput {
    targetWord: string;
    modifiers: string[];
}

export const L0_PHRASE_SYSTEM_PROMPT = `
# ROLE
You are the "Expansion Engine" for Opus Level 0.

# OBJECTIVE
Generate "Expanded Phrase" cards using 1+N strategy.

# CONSTRAINTS
1. **Structure**: Adjective + Noun OR Adverb + Verb.
2. **Focus**: Modifiers that change the nuance.
`.trim();

export function getL0PhraseBatchPrompt(inputs: PhraseGeneratorInput[]) {
    return { system: L0_PHRASE_SYSTEM_PROMPT, user: JSON.stringify(inputs) };
}
