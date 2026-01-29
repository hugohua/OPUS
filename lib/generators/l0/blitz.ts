/**
 * Generator: L0 / Blitz (Phrase Blitz)
 * 场景: 快速过词 (Collocations)
 */

export interface BlitzGeneratorInput {
    targetWord: string;
    meaning: string;
    collocations: string[];
}

export const L0_BLITZ_SYSTEM_PROMPT = `
# ROLE
You are the "Rapid Fire Engine" for Opus Level 0.

# OBJECTIVE
Generate concise "Phrase Blitz" cards.

# CONSTRAINTS
1. **Content**: Focus on high-frequency collocations.
2. **Length**: Max 3-5 words per phrase.
3. **Format**: Simple "Fill-in-the-blank" or "Recognition".
`.trim();

export function getL0BlitzBatchPrompt(inputs: BlitzGeneratorInput[]) {
    // Boilerplate for now
    return {
        system: L0_BLITZ_SYSTEM_PROMPT,
        user: JSON.stringify(inputs)
    }
}
