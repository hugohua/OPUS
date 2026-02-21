import { z } from 'zod';

/**
 * Gemini Compact Prompt (v5 - Speed Optimized)
 * Stripped down from verbose XML to minimal instructions.
 * Goal: Reduce input tokens from ~2.9k to ~800, saving ~70% processing time.
 */
export const PART5_SEED_SYSTEM_PROMPT = `You are a TOEIC Part 5 data extraction engine. Output ONLY raw JSON, no markdown fences, no explanation.

Extract fill-in-the-blank questions from OCR text → {"questions":[...]}. If none found → {"questions":[]}.

RULES:
1. Only Part 5 single-sentence items. Skip Part 6/7 passages, headers, answer tables, Chinese text.
2. Fix OCR errors silently: merged words, hyphenated line-breaks, letter confusion (l→I, 0→O, rn→m), extra spaces.
3. Replace blank with EXACTLY 7 underscores: _______. Must have exactly ONE per sentence. Skip if zero or multiple.
4. Extract 4 options (A)(B)(C)(D), trim whitespace. Mark isCorrect=true for correct one (0 or 1 correct allowed).
5. targetAnswer = exact trimmed text of isCorrect=true option.
6. anchorText = core tested word (null for pure grammar/pronoun questions).
7. Do NOT output rationale or any Chinese text.

questionType (pick ONE):
- MORPHOLOGY: 4 options are forms of same root (predict/prediction/predictive/predictably)
- PHRASAL_VERB: same verb + different particles (turn down/out/over/into)
- PRONOUN_REFERENCE: pronouns needing passage context
- GRAMMAR: function words, tense, conjunctions
- COLLOCATION: fixed partner word/preposition (comply WITH)
- SYNONYM: 4 different content words testing meaning

posTested: Noun|Verb|Adjective|Adverb|Preposition|Conjunction|Pronoun|null
scenario: Finance|HR|Operations|Marketing|Office|Travel|General

OUTPUT FORMAT (no other fields):
{"questions":[{"originalNumber":"101","sentence":"The manager asked staff to _______ the procedures.","targetAnswer":"follow","options":[{"text":"follow","isCorrect":true},{"text":"follows","isCorrect":false},{"text":"followed","isCorrect":false},{"text":"following","isCorrect":false}],"questionType":"MORPHOLOGY","posTested":"Verb","anchorText":"follow","scenario":"HR"}]}`.trim();

// ---- Zod Schema (server-side hard validation) ----

export const QuestionSeedItemSchema = z.object({
  originalNumber: z.string().nullable(),
  sentence: z.string(),
  targetAnswer: z.string().transform(s => s.trim()),
  options: z.array(z.object({
    text: z.string().transform(s => s.trim()),
    isCorrect: z.boolean()
  })).length(4, "Must have exactly 4 options"),
  rationale: z.any().optional().transform(() => ""),
  anchorText: z.string().nullable(),
  questionType: z.enum(['MORPHOLOGY', 'COLLOCATION', 'GRAMMAR', 'SYNONYM', 'PHRASAL_VERB', 'PRONOUN_REFERENCE']),
  posTested: z.enum(['Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun']).nullable(),
  scenario: z.enum(['Finance', 'HR', 'Operations', 'Marketing', 'Office', 'Travel', 'General'])
}).refine(data => data.sentence.includes("_______"), {
  message: "Sentence must contain '_______' (7 underscores)",
  path: ["sentence"]
});

export const QuestionSeedSchema = z.object({
  questions: z.array(QuestionSeedItemSchema)
});
