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
/**
 * 通用 Phrase Payload 构建器 (供 PhraseMode 和 DeterministicFallback 复用)
 */
export function createPhrasePayload(
    vocab: Pick<Vocab, 'id' | 'word' | 'definition_cn' | 'phoneticUs' | 'partOfSpeech'>,
    phrase: string,
    translation: string,
    mode: 'PHRASE' | string = 'PHRASE',
    source: string = 'db_collocation',
    etymology?: any // [New]
): BriefingPayload {
    // 1. Highlight Logic (Simple Regex)
    // Replace the target word (case-insensitive) with **word**
    const escapedWord = vocab.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedWord}\\w*)`, 'gi');
    const questionMarkdown = phrase.replace(regex, '**$1**');

    // 2. Construct Payload
    return {
        meta: {
            format: 'chat',
            mode: mode as any,
            batch_size: 1,
            sys_prompt_version: 'deterministic-v1-phrase',
            vocabId: vocab.id,
            target_word: vocab.word,
            source: source,
            etymology: etymology // [New]
        },
        segments: [
            {
                type: 'text',
                content_markdown: questionMarkdown, // The Question (Front)
                translation_cn: translation,        // The Answer (Back)
                phonetic: vocab.phoneticUs || undefined // [Fix] Add phonetic field
            },
            {
                type: 'interaction',
                dimension: 'C', // Mapping to Context/Chunking
                task: {
                    style: 'bubble_select', // reused, but handled as 3-Button in UI
                    question_markdown: questionMarkdown, // Redundant but consistent
                    options: ['Forgot', 'Blurry', 'Know'], // Symbolic options
                    answer_key: 'Know', // Dummy key
                    explanation_markdown: `**${vocab.word}**: ${vocab.definition_cn}\n\n[${vocab.phoneticUs || ''}] ${vocab.partOfSpeech || ''}`
                }
            }
        ]
    };
}

export function buildPhraseDrill(vocab: Vocab): BriefingPayload | null {
    // 1. Extract Phrase
    let phrase = "";
    let translation = "";

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
        // Skip if no context available
        return null;
    }

    // 2. Delegate to generic builder
    return createPhrasePayload(vocab, phrase, translation, 'PHRASE', 'db_collocation', (vocab as any).etymology);
}
