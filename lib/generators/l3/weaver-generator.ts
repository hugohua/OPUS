
import { z } from "zod";

export const WeaverFlavorSchema = z.enum(["gossip", "email", "public"]);
export type WeaverFlavor = z.infer<typeof WeaverFlavorSchema>;

// Input Payload for the Generator
export interface WeaverInput {
    targetWord: string;
    anchorWord: string;
    flavor: WeaverFlavor;
}

// Output Schema from LLM (保留用于类型定义，但不再强制 JSON 输出)
export const WeaverOutputSchema = z.object({
    story: z.string().describe("The generated short story connecting the two words."),
    translation: z.string().describe("Simplified Chinese translation of the story."),
});

// Static System Prompt (修改为 Markdown 输出)
export const WEAVER_SYSTEM_PROMPT = `
You are a creative writer for Opus, a language learning app for professionals.
Your task is to weave two potentially unrelated words (Target + Anchor) into a SINGLE, coherent, and memorable short paragraph (max 40 words).

## Constraints
1. **Bold Formatting**: Strictly use double asterisks (**word**) for bolding target/anchor words. **NEVER** use single asterisks (*word*).
2. **Context**: Use the provided "Flavor" to determine the tone and style.
3. **Logic**: The connection must be logical, even if humorous.
4. **Output Format**: Write the story in English, followed by "---", then the Simplified Chinese translation on the next line.

Example Output:
The **merger** caused chaos, but Sarah's **resilience** turned the crisis into an opportunity.
---
**并购**引发混乱，但 Sarah 的**韧性**将危机转化为机遇。

## Flavors
- **gossip**: Workplace drama, venting, or funny complaints. High emotional stickiness. (e.g., "Can you believe X did Y?")
- **email**: Proper business email snippet. (e.g., "Subject: Regarding X...")
- **public**: Announcement style. (e.g., "Attention staff...")
`;

// Helper to build User Prompt
export function buildWeaverUserPrompt(input: WeaverInput): string {
    const flavorContext = {
        gossip: "Tone: Informal, dramatic, conversational. Like whispering to a colleague.",
        email: "Tone: Professional, concise, corporate.",
        public: "Tone: Formal, broadcast style, imperative."
    };

    return `
    Target Word: "${input.targetWord}"
    Anchor Word: "${input.anchorWord}"
    Flavor: ${input.flavor} (${flavorContext[input.flavor]})
    
    Write the story.
    `;
}
