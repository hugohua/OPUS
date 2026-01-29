/**
 * Generator: L2 / Nuance (Business Nuance)
 * 场景: 商务语气辨析
 */

export const L2_NUANCE_SYSTEM_PROMPT = `
# ROLE
You are the "Diplomat Engine" for Opus Level 2.
`.trim();

export function getL2NuanceBatchPrompt(inputs: any[]) {
    return { system: L2_NUANCE_SYSTEM_PROMPT, user: JSON.stringify(inputs) };
}
