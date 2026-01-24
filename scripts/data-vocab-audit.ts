/**
 * Data Quality Audit Script
 * 
 * 功能：
 *   执行三层“分层防御”检查，确保 AI 生成数据的质量。
 *   1. 结构层：检查空值、格式错误。
 *   2. 规则层：检查逻辑错误（重复同义词、自指、幻觉文本）。
 *   3. 语义层（Canary）：针对高风险多义词（Address, Minute 等）进行金丝雀测试。
 * 
 * 使用方法：
 *   npx tsx scripts/data-vocab-audit.ts
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '../generated/prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Collocation minimal schema for loose validation
const CollocationItemSchema = z.object({
    text: z.string(),
    trans: z.string(),
});
const CollocationsArraySchema = z.array(CollocationItemSchema);

// Canary Words List
const CANARY_WORDS = [
    'address', 'minute', 'tender', 'close', 'project', 'board', 'receiver'
];

interface AuditIssue {
    word: string;
    layer: 'STRUCTURE' | 'RULE' | 'SEMANTIC';
    issueType: string;
    details: any;
}

async function main() {
    console.log('🛡️  Starting Data Quality Audit...');

    // Only verify CORE words for now as they are critical
    const words = await prisma.vocab.findMany({
        where: {
            is_toeic_core: true
        },
        select: {
            id: true,
            word: true,
            definition_cn: true,
            synonyms: true,
            scenarios: true,
            collocations: true,
            confusing_words: true,
            tags: true,
        },
        orderBy: { word: 'asc' }
    });

    console.log(`📊 Total Core Words to Scan: ${words.length}`);
    console.log('-'.repeat(50));

    const issues: AuditIssue[] = [];
    const canaryResults: any[] = [];

    for (const w of words) {
        // --- Layer 1: Structure Checks (SQL-like) ---

        // 1. Check Missing definition_cn
        if (!w.definition_cn) {
            issues.push({
                word: w.word,
                layer: 'STRUCTURE',
                issueType: 'Missing Definition',
                details: null
            });
        }

        // 2. Check Empty Arrays (Synonyms/Scenarios)
        if (!w.synonyms || w.synonyms.length < 2) {
            // Allowing 1 synonym is suspicious for an English word in TOEIC context, usually there are more.
            // But let's verify empty mainly.
            if (!w.synonyms || w.synonyms.length === 0) {
                issues.push({
                    word: w.word,
                    layer: 'STRUCTURE',
                    issueType: 'Empty Synonyms',
                    details: w.synonyms
                });
            } else if (w.synonyms.length < 2) {
                // Warning level
                issues.push({
                    word: w.word,
                    layer: 'RULE',
                    issueType: 'Low Synonym Count (<2)',
                    details: w.synonyms
                });
            }
        }

        if (!w.scenarios || w.scenarios.length === 0) {
            issues.push({
                word: w.word,
                layer: 'STRUCTURE',
                issueType: 'Empty Scenarios',
                details: w.scenarios
            });
        }

        // --- Layer 2: Rule Checks (Logic/Hallucination) ---

        // 3. Duplicate Synonyms
        if (w.synonyms && w.synonyms.length > 0) {
            const unique = new Set(w.synonyms.map(s => s.toLowerCase().trim()));
            if (unique.size !== w.synonyms.length) {
                issues.push({
                    word: w.word,
                    layer: 'RULE',
                    issueType: 'Duplicate Synonyms',
                    details: w.synonyms
                });
            }

            // 4. Self-Referencing Synonym
            if (unique.has(w.word.toLowerCase().trim())) {
                issues.push({
                    word: w.word,
                    layer: 'RULE',
                    issueType: 'Self-Referencing Synonym',
                    details: w.synonyms
                });
            }
        }

        // 5. Hallucination / Malformed Collocations
        if (w.collocations) {
            const colStr = JSON.stringify(w.collocations);
            // Rough text check for hallucinations
            if (colStr.includes('Here is') || colStr.includes('I cannot') || colStr.includes('AI model') || colStr.includes('Sorry')) {
                issues.push({
                    word: w.word,
                    layer: 'RULE',
                    issueType: 'Hallucination in Collocations',
                    details: colStr.substring(0, 50) + '...'
                });
            } else if (Array.isArray(w.collocations) && w.collocations.length === 0) {
                // [NEW] Check for empty array
                issues.push({
                    word: w.word,
                    layer: 'STRUCTURE',
                    issueType: 'Empty Collocations',
                    details: '[]'
                });
            } else {
                // Structural check for collocations
                const parsed = CollocationsArraySchema.safeParse(w.collocations);
                if (!parsed.success) {
                    issues.push({
                        word: w.word,
                        layer: 'STRUCTURE',
                        issueType: 'Invalid Collocation Format',
                        details: 'Schema validation failed'
                    });
                } else {
                    // Check for empty text/trans inside
                    parsed.data.forEach(c => {
                        if (!c.text || c.text.trim() === '' || !c.trans || c.trans.trim() === '') {
                            issues.push({
                                word: w.word,
                                layer: 'RULE',
                                issueType: 'Empty Collocation Field',
                                details: c
                            });
                        }
                    });
                }
            }
        } else {
            // Collocations is null
            issues.push({
                word: w.word,
                layer: 'STRUCTURE',
                issueType: 'Missing Collocations',
                details: null
            });
        }

        // --- Layer 3: Semantic Canary Checks ---
        // (Moved down)

        // 6. Check Confusing Words & Tags (Pro Max)
        if (!w.confusing_words || w.confusing_words.length === 0) {
            // Not an error per se, but worth noting for "Pro Max" quality
            // issues.push({
            //     word: w.word,
            //     layer: 'STRUCTURE',
            //     issueType: 'Empty Confusing Words',
            //     details: null
            // });
        }

        if (CANARY_WORDS.includes(w.word.toLowerCase())) {
            canaryResults.push({
                word: w.word,
                definition: w.definition_cn,
                synonyms: w.synonyms,
                scenarios: w.scenarios,
                // collocations: w.collocations // Too long to print usually
            });
        }
    }

    // --- Output Report ---

    if (issues.length > 0) {
        console.log(`❌ Found ${issues.length} Issues:\n`);

        // Group by Issue Type
        const issueGroups: Record<string, number> = {};
        issues.forEach(i => {
            issueGroups[i.issueType] = (issueGroups[i.issueType] || 0) + 1;
        });
        console.table(issueGroups);
        console.log('');

        console.log('--- Top 20 Issue Samples ---');
        issues.slice(0, 20).forEach(i => {
            console.log(`[${i.layer}] ${i.word.padEnd(15)}: ${i.issueType} -> ${JSON.stringify(i.details)}`);
        });
        if (issues.length > 20) console.log(`... and ${issues.length - 20} more.`);
    } else {
        console.log('✅ No structural or rule-based issues found!');
    }

    console.log('\n🐤 --- Canary Word Report (Manual Spot Check) ---');
    if (canaryResults.length === 0) {
        console.log('⚠️  Warning: No canary words found in the processed list (are they marked is_toeic_core?)');
    } else {
        canaryResults.forEach(c => {
            console.log(`\nWord: 【 ${c.word} 】`);
            console.log(`   Def: ${c.definition}`);
            console.log(`   Scenarios: ${c.scenarios?.join(', ')}`);
            console.log(`   Synonyms:  ${c.synonyms?.join(', ')}`);
        });
    }

}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
