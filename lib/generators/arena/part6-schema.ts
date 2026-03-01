import { z } from "zod";

// Interaction options schema (1 correct, 3 distractors)
const OptionSchema = z.object({
    text: z.string(),
    is_correct: z.boolean(),
    explanation_markdown: z.string(),
});

// 单个交互 schema（含 answer_key ↔ options 交叉校验）
const Part6InteractionSchema = z.object({
    type: z.literal("interaction"),
    dimension: z.enum(["V", "M", "X", "C"]),
    option_level: z.enum(["word", "phrase", "sentence"]).optional(), // [V9.0] 选项粒度标记
    task: z.object({
        style: z.literal("bubble_select").describe("Part 6 strictly uses bubble_select"),
        question_markdown: z.string().describe("Contextual question prompt if needed"),
        options: z.array(OptionSchema).length(4, "Each question must have exactly 4 options"),
        answer_key: z.string().describe("Must match the text of the correct option"),
        explanation_markdown: z.string().describe("Overall explanation for this specific blank"),
    }),
}).refine(
    (data) => data.task.options.some(o => o.is_correct && o.text === data.task.answer_key),
    { message: "answer_key must match the text of the option marked is_correct: true" }
);

// Full Output Schema for LLM
export const Part6OutputSchema = z.object({
    passage_markdown: z.string().describe("The full business passage with 4 blanks strictly formatted as [__BLANK_1__], [__BLANK_2__], etc."),
    target_word_blank_index: z.number().int().min(1).max(4).describe("Which blank (1-4) tests the primary Target Word"),
    interactions: z.array(Part6InteractionSchema).length(4, "Must contain exactly 4 interactions, corresponding to the 4 blanks in order"),
});

export type Part6Output = z.infer<typeof Part6OutputSchema>;
