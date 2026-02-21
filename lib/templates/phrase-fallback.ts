import { BriefingPayload, SessionMode } from '@/types/briefing';
import { VocabDrillInput } from './deterministic-drill';
import { createPhrasePayload } from './phrase-drill';

/**
 * 从词汇输入中提取最佳的示例句子和翻译
 */
export function extractSentenceForFallback(vocab: VocabDrillInput): { sentence: string, translation: string } {
    let sentence = "";
    let translation = "";

    // 1. Check for collocations
    if (vocab.collocations && Array.isArray(vocab.collocations) && vocab.collocations.length > 0) {
        const candidates = vocab.collocations as any[];
        const bestCollo = candidates.find(c => c.text && c.trans);

        if (bestCollo) {
            sentence = bestCollo.text;
            translation = bestCollo.trans;
        } else {
            const textOnly = candidates.find(c => c.text);
            if (textOnly) {
                sentence = textOnly.text;
                translation = vocab.definition_cn || "";
            }
        }
    }

    // 2. Fallback to commonExample
    if (!sentence && vocab.commonExample) {
        sentence = vocab.commonExample;
        translation = vocab.definition_cn || "";
    }

    // 3. Last Resort: Construct artificial sentence
    if (!sentence) {
        sentence = `The word "${vocab.word}" means ${vocab.definition_cn || 'something'}.`;
        translation = vocab.definition_cn || "未知";
    }

    return { sentence, translation };
}

/**
 * 记忆卡 (PHRASE) 格式的通用兜底生成器 (Fallback Generator)
 * 功能：
 *   只负责生成标准记忆卡片结构的兜底数据
 */
export function buildPhraseFallbackDrill(vocab: VocabDrillInput, mode: SessionMode): BriefingPayload {
    const { sentence, translation } = extractSentenceForFallback(vocab);

    return createPhrasePayload(
        {
            id: vocab.id,
            word: vocab.word,
            definition_cn: vocab.definition_cn || '',
            phoneticUs: vocab.phoneticUs ?? vocab.phoneticUk ?? null,
            partOfSpeech: vocab.partOfSpeech ?? null
        },
        sentence,
        translation,
        mode,
        'deterministic_fallback',
        vocab.etymology
    );
}
