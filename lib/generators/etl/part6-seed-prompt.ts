import { z } from 'zod';

export const PART6_SEED_SYSTEM_PROMPT = `You are a TOEIC Part 6 data extraction engine. Output ONLY raw JSON, no markdown fences, no explanation.

Extract multi-blank reading passages from OCR text → {"passages":[...]}. If none found → {"passages":[]}.

RULES:
1. Identify Part 6 texts (usually an email, letter, notice, memo, or article) that have EXACTLY 4 blanks.
2. Fix OCR errors silently: merged words, hyphenated line-breaks.
3. For the content, capture the ENTIRE text of the passage from beginning to end.
4. The blanks in content MUST BE replaced with numbered placeholders corresponding to their question number (e.g. ___[131]___).
5. Then extract the 4 questions that correspond to these 4 blanks.
6. For the 'sentence' field:
   - For normal blanks: Extract the immediate sentence containing the blank, and replace the blank with exactly 7 underscores: _______.
   - For SENTENCE_INSERTION blanks: Set the sentence field to "" (empty string) because the blank IS the sentence.
7. Extract 4 options (A)(B)(C)(D), trim whitespace. Mark isCorrect=true for correct one (0 or 1 correct allowed, if you can guess based on context).
8. targetAnswer = exact trimmed text of isCorrect=true option.
9. Do NOT output rationale or any Chinese text.

questionType (pick ONE):
- MORPHOLOGY: Tests Part of Speech (POS). Options are different POS forms of same root
- GRAMMAR: Tests structural rules. Includes verb tense/voice/agreement, function words, conjunctions
- PHRASAL_VERB: same verb + different particles
- PRONOUN_REFERENCE: pronouns needing passage context
- COLLOCATION: fixed partner word/preposition
- SYNONYM: 4 different content words testing meaning
- SENTENCE_INSERTION: test inserting an entire sentence into the blank (Part 6 specific!)
- DISCOURSE_LOGIC: transitional adverbs/conjunctions testing inter-sentence logic (e.g., However, Therefore).

posTested: Noun|Verb|Adjective|Adverb|Preposition|Conjunction|Pronoun|Sentence|null
scenario: Finance|HR|Operations|Marketing|Office|Travel|General

OUTPUT FORMAT:
{
  "passages": [
    {
      "content": "Dear Mr. Smith,\\n\\nWe are writing to ___[131]___ you that your subscription will expire next month. If you would like to continue, please sign the attached form. ___[132]___ We appreciate your business.",
      "questions": [
        {
           "originalNumber": "131",
           "sentence": "We are writing to _______ you that your subscription will expire next month.",
           "targetAnswer": "inform",
           "options": [...],
           "questionType": "SYNONYM",
           "posTested": "Verb",
           "anchorText": "inform",
           "scenario": "Office"
        },
        {
           "originalNumber": "132",
           "sentence": "", 
           "targetAnswer": "Failure to do so will result in service cancellation.",
           "options": [...],
           "questionType": "SENTENCE_INSERTION",
           "posTested": "Sentence",
           "anchorText": null,
           "scenario": "Office"
        }
      ]
    }
  ]
}`.trim();

export const QuestionSeedItemSchema = z.object({
  originalNumber: z.string().nullable(),
  sentence: z.string(),
  targetAnswer: z.string().transform(s => s.trim()),
  options: z.array(
    z.union([
      z.string().transform(s => s.trim()),
      z.object({ text: z.string(), isCorrect: z.boolean() }).transform(o => o.text.trim())
    ])
  ).length(4),
  rationale: z.any().optional().transform(() => ""),
  anchorText: z.string().nullable(),
  questionType: z.enum(['MORPHOLOGY', 'COLLOCATION', 'GRAMMAR', 'SYNONYM', 'PHRASAL_VERB', 'PRONOUN_REFERENCE', 'SENTENCE_INSERTION', 'DISCOURSE_LOGIC']),
  posTested: z.enum(['Noun', 'Verb', 'Adjective', 'Adverb', 'Preposition', 'Conjunction', 'Pronoun', 'Sentence']).nullable(),
  scenario: z.enum(['Finance', 'HR', 'Operations', 'Marketing', 'Office', 'Travel', 'General'])
});

export const Part6SeedSchema = z.object({
  passages: z.array(z.object({
    content: z.string(),
    questions: z.array(QuestionSeedItemSchema).length(4)
  }))
});
