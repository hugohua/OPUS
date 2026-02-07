
import { db } from '@/lib/db';
import { buildSimpleDrill } from '@/lib/templates/deterministic-drill';
import { createPhrasePayload } from '@/lib/templates/phrase-drill';

async function main() {
    console.log('🔍 Debugging Phrase Generation...');

    // 1. Fetch a sample vocab
    const targetWord = process.argv[2] || 'review';
    const vocab = await db.vocab.findFirst({
        where: { word: targetWord },
        include: { etymology: true } // [New]
    });

    if (!vocab) {
        console.error('❌ Vocab not found');
        return;
    }

    console.log('📝 Test Word:', vocab.word);
    console.log('📝 Definitions:', vocab.definition_cn);
    console.log('📝 Phonetic:', vocab.phoneticUs || vocab.phoneticUk);

    // 2. Test buildSimpleDrill (Main Fallback Path)
    console.log('\n--- Testing buildSimpleDrill (PHRASE) ---');
    const drill = buildSimpleDrill({
        id: vocab.id,
        word: vocab.word,
        definition_cn: vocab.definition_cn,
        commonExample: vocab.commonExample,
        phoneticUk: vocab.phoneticUk,
        phoneticUs: vocab.phoneticUs,
        partOfSpeech: vocab.partOfSpeech,
        collocations: vocab.collocations,
        etymology: (vocab as any).etymology // [New]
    }, 'PHRASE');

    console.log(JSON.stringify(drill, null, 2));

    // 3. Check for specific issues
    const textSegment = drill.segments.find(s => s.type === 'text');

    if (!textSegment) {
        console.error('❌ Missing text segment');
    } else {
        console.log('\n--- Segment Analysis ---');
        console.log('content_markdown:', textSegment.content_markdown);
        console.log('phonetic:', textSegment.phonetic);
        console.log('translation_cn:', textSegment.translation_cn);

        if (textSegment.content_markdown?.includes('###')) {
            console.error('❌ "###" detected in content_markdown!');
        } else {
            console.log('✅ content_markdown looks safe.');
        }

        if (!textSegment.phonetic) {
            console.error('❌ Missing "phonetic" field in segment!');
        }
    }
}

main();
