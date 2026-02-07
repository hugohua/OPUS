/**
 * 脚本：AI Judge - 上下文选词质量评估
 * 
 * 功能：
 * 1. 随机选取 N 个测试词汇 (Target)。
 * 2. 使用 ContextSelector (V2) 为每个词生成上下文。
 * 3. 调用 LLM (GPT-4o/Claude) 对选词结果进行语义打分 (1-5分)。
 * 
 * 使用方法：
 * npx tsx scripts/evaluate-context-quality.ts [count]
 * 
 * 参数：
 * - count: 测试样本数量 (默认: 5)
 * 
 * 示例：
 * npx tsx scripts/evaluate-context-quality.ts 10
 */

import { ContextSelector } from '@/lib/ai/context-selector';
import { prisma } from '@/lib/db';
import { AIService } from '@/lib/ai/core';
import { createLogger } from '@/lib/logger';

const log = createLogger('eval-script');
const TEST_USER_ID = 'test-user-1';

async function main() {
    const args = process.argv.slice(2);
    const sampleCount = parseInt(args[0] || '5', 10);

    console.log(`\n🔍 Starting Evaluation (Sample Count: ${sampleCount})...\n`);

    // 1. Get Random Target Words that have embeddings
    const targets = await prisma.$queryRaw<{ id: number; word: string }[]>`
        SELECT id, word 
        FROM "Vocab" 
        WHERE embedding IS NOT NULL
          AND CHAR_LENGTH(word) > 3
        ORDER BY RANDOM()
        LIMIT ${sampleCount};
    `;

    if (!targets || targets.length === 0) {
        console.error('No suitable target words found (with embeddings).');
        return;
    }

    let totalScore = 0;

    for (const target of targets) {
        console.log(`--------------------------------------------------`);
        console.log(`🎯 Target: ${target.word}`);

        // 2. Select Context (Use V2 Logic)
        const contextWords = await ContextSelector.select(TEST_USER_ID, target.id, {
            count: 3,
            strategies: ['USER_VECTOR', 'GLOBAL_VECTOR', 'RANDOM'], // Full pipeline
            minDistance: 0.15,
            maxDistance: 0.5
        });

        const contextList = contextWords.map(w => w.word);
        console.log(`📋 Context: [${contextList.join(', ')}]`);

        if (contextList.length === 0) {
            console.log('⚠️  No context found (unexpected). Score: 0/5');
            continue;
        }

        // 3. AI Judge (PRO Version)
        const prompt = `
        You are a strict linguistic editor for a TOEIC Business English training system.
        
        Task: Evaluate the quality of a "Word Cluster" for sentence generation. 
        The goal is to write ONE natural, professional business sentence that includes the Target Word and ALL Context Words.
        
        Target: "${target.word}"
        Context: ["${contextList.join('", "')}"]
        
        Evaluation Criteria:
        1. Semantic Cohesion: Do the words belong to the same specific business scenario? (e.g., "Invoice" + "Pay" + "Finance")
        2. Grammatical Diversity: Can they form a syntactic structure? (Avoid having 5 nouns and 0 verbs).
        3. NO Redundancy: Context words should NOT be direct synonyms of the Target word. (e.g., Target "Big" + Context "Large" is BAD).
        
        Scoring Rules:
        - 5 (Perfect): Can easily form a natural, non-redundant TOEIC-level sentence. Diverse parts of speech.
        - 4 (Good): Coherent, but maybe one word is slightly generic.
        - 3 (Passable): Can form a sentence, but it feels forced or repetitive.
        - 2 (Weak): Words are related but hard to combine into a single sentence (e.g. conflicting meanings).
        - 1 (Fail): Random words or pure synonyms that make the sentence look stupid.
        
        Step-by-step Thinking (Internal):
        1. Try to compose a sentence using all words.
        2. Check if the sentence sounds like a native business speaker.
        3. Check for synonym repetition.
        
        Output Format: JSON ONLY
        {
            "score": <number 1-5>,
            "reason": "<One sentence critique. Mention specific words if they don't fit.>",
            "redundancy_detected": <boolean>,
            "suggested_sentence": "<Draft a sentence to prove it works (or explain why it fails)>"
        }
        `;

        try {
            const { text } = await AIService.generateText({
                system: 'You are a strict JSON-only output machine.',
                prompt: prompt,
                mode: 'smart'
            });

            // Simple parsing
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                console.log(`🤖 AI Judge: ${result.score}/5`);
                console.log(`📝 Reason: ${result.reason}`);
                console.log(`✨ Proof: "${result.suggested_sentence}"`);
                if (result.redundancy_detected) {
                    console.log(`⚠️  REDUNDANCY DETECTED`);
                }
                totalScore += result.score;
            } else {
                console.log('⚠️  AI Parse Failed:', text);
            }

        } catch (e) {
            console.error('AI Request Failed:', e);
        }
    }

    const avgScore = totalScore / targets.length;
    console.log(`\n==================================================`);
    console.log(`🏆 Final Report`);
    console.log(`Samples: ${targets.length}`);
    console.log(`Average Score: ${avgScore.toFixed(2)} / 5.0`);

    if (avgScore > 4.0) console.log(`✅ RESULT: EXCELLENT QUALITY`);
    else if (avgScore > 3.0) console.log(`⚠️ RESULT: ACCEPTABLE`);
    else console.log(`❌ RESULT: NEEDS TUNING`);
    console.log(`==================================================\n`);
}

main().finally(() => prisma.$disconnect());
