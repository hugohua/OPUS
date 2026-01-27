import { BriefingPayload } from '@/types/briefing';
import { Vocab } from '@prisma/client';

/**
 * 构建 Phrase Mode (Flashcard) 的 Drill Payload
 * 
 * Data Source Preference:
 * 1. collocations (DB JSON) -> Short Phrase
 * 2. commonExample -> Fallback (Truncated if too long)
 * 3. Word itself -> Last Resort
 */
export function buildPhraseDrill(vocab: Vocab): BriefingPayload | null {
    // 1. Extract Phrase
    let phrase = "";
    let translation = "";
    let questionMarkdown = "";

    // Type casting for DB Json
    const collocations = vocab.collocations as any[];

    if (collocations && Array.isArray(collocations) && collocations.length > 0) {
        // Use the first collocation (usually most frequent)
        const col = collocations[0];
        phrase = col.text || "";
        translation = col.trans || "";
    } else if (vocab.commonExample) {
        // Fallback to example
        phrase = vocab.commonExample;
        translation = vocab.definition_cn || "";
    } else {
        // Skip if no context available (or just show word?)
        // Design Decision: Returns null to let dispatcher pick another word or handle gracefully
        return null;
    }

    // 2. Highlight Logic (Simple Regex)
    // Replace the target word (case-insensitive) with **word**
    // Also handle variations if possible, but simple replacement is fast.
    const escapedWord = vocab.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedWord}\\w*)`, 'gi');
    questionMarkdown = phrase.replace(regex, '**$1**');

    // 3. Construct Payload
    return {
        meta: {
            format: 'chat', // reusing format type
            mode: 'PHRASE',
            batch_size: 1,
            sys_prompt_version: 'deterministic-v1-phrase',
            vocabId: vocab.id,
            target_word: vocab.word,
            source: 'db_collocation'
        },
        segments: [
            {
                type: 'text',
                content_markdown: questionMarkdown, // The Question (Front)
                translation_cn: translation         // The Answer (Back)
            },
            {
                type: 'interaction',
                dimension: 'C', // Mapping to Context/Chunking
                task: {
                    style: 'bubble_select', // reused, but handled as 3-button in UI
                    question_markdown: questionMarkdown, // Redundant but consistent
                    options: ['Forgot', 'Blurry', 'Know'], // Symbolic options
                    answer_key: 'Know', // Dummy key
                    explanation_markdown: `**${vocab.word}**: ${vocab.definition_cn}\n\n[${vocab.phoneticUs || ''}] ${vocab.partOfSpeech || ''}`
                }
            }
        ]
    };
}
