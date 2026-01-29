/**
 * LLM Prompt Evaluation Runner
 * Usage: npx tsx scripts/eval-prompts.ts --mode L1_CHUNKING [--compare] [--judge ets-auditor]
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { generateWithFailover } from '../workers/llm-failover';

// ----------------------------------------------------------------------------
// Types & Constants
// ----------------------------------------------------------------------------

const JUDGE_PROMPTS: Record<string, string> = {
    'ets-auditor': `
You are a Senior Content Auditor for ETS (Educational Testing Service), specifically for the TOEIC exam.
Your job is to REJECT any content that feels "AI-generated" or "Unnatural".

**Evaluation Criteria:**
1. **Context Authenticity**: Does the sentence sound like a real business email/memo?
2. **Distractor Quality**: Are the wrong options (distractors) plausible but definitely wrong?
3. **Logic Flow**: Is the reason for the correct answer 100% logical?

**Output Format (JSON ONLY):**
{
  "score": number (1-10),
  "reason": "Explicit explanation of why it passes/fails",
  "suggestion": "Specific advice to improve the System Prompt"
}
    `.trim(),
    'anxious-engineer': `
You are a Junior Software Engineer with a TOEIC score of 350. You have very little patience for linguistic jargon.

**Evaluation Criteria:**
1. **Clarity**: Is the explanation instant to understand?
2. **Speed**: Can I read the sentence in 3 seconds?
3. **Relevance**: Does the Chinese definition make sense in a workplace context?

**Output Format (JSON ONLY):**
{
  "score": number (1-10),
  "reason": "Explicit explanation",
  "suggestion": "Specific advice to simplify or contextualize"
}
    `.trim()
};

interface EvalRecord {
    id: string;
    description: string;
    input: any;
    primary: ModelResult;
    secondary?: ModelResult;
}

interface ModelResult {
    model: string;
    text: string;
    structureOk: boolean;
    judge?: {
        score: number;
        reason: string;
        suggestion?: string;
    };
}

// ----------------------------------------------------------------------------
// Core Logic
// ----------------------------------------------------------------------------

async function main() {
    const args = process.argv.slice(2);
    const mode = getValue(args, '--mode');
    const compare = args.includes('--compare');
    const judgeRole = getValue(args, '--judge');

    if (!mode) {
        console.log('Usage: npx tsx scripts/eval-prompts.ts --mode <MODE> [--compare] [--judge <ROLE>]');
        process.exit(1);
    }

    console.log(`\n🚀 Starting Evaluation: [${mode}] ${compare ? '(Multi-Model Comparison)' : ''}`);

    // 1. Load Dataset
    const datasetPath = path.resolve(process.cwd(), `tests/evals/${mode.toLowerCase().replace(/_/g, '-')}.json`);
    if (!fs.existsSync(datasetPath)) {
        console.error(`❌ Dataset not found at: ${datasetPath}`);
        process.exit(1);
    }
    const testCases = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    console.log(`Dataset size: ${testCases.length} cases`);

    // 2. Resolve Generator
    const generator = await getGenerator(mode);

    // 3. Batch Generation
    console.log('\n--- Batch Generating Content ---');

    // Prepare Inputs (All at once)
    const inputs = testCases.map((tc: any) => tc.input);
    const prompt = generator(inputs);

    // A. Primary Model Phase
    const primaryModelName = process.env.AI_MODEL_NAME || 'aliyun';
    console.log(`[Primary] Calling ${primaryModelName} with ${inputs.length} items...`);
    const primaryOutputs = await runBatchModel(primaryModelName, prompt, inputs.length);
    console.log(`[Primary] Received ${primaryOutputs.length} valid items.`);

    // B. Secondary Model Phase (Optional)
    let secondaryOutputs: any[] = [];
    const secondaryModelName = process.env.ETL_MODEL_NAME || 'openrouter';

    if (compare) {
        const originalOrder = process.env.AI_PROVIDER_ORDER;
        process.env.AI_PROVIDER_ORDER = 'openrouter';
        console.log(`[Secondary] Calling ${secondaryModelName} with ${inputs.length} items...`);

        secondaryOutputs = await runBatchModel(secondaryModelName, prompt, inputs.length);
        console.log(`[Secondary] Received ${secondaryOutputs.length} valid items.`);

        process.env.AI_PROVIDER_ORDER = originalOrder;
    }

    // 4. Map & Judge
    console.log('\n--- Grading & Judging ---');
    const records: EvalRecord[] = [];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        const record: EvalRecord = {
            id: testCase.id,
            description: testCase.description,
            input: testCase.input,
            primary: { model: primaryModelName, text: '', structureOk: false }
        };

        process.stdout.write(`Evaluating ${testCase.id}... `);

        // Map Primary Result
        const pOut = primaryOutputs[i];
        if (pOut) {
            record.primary.text = JSON.stringify(pOut, null, 2);
            record.primary.structureOk = true;
            if (judgeRole) {
                record.primary.judge = await runJudge(record.primary.text, judgeRole);
            }
        } else {
            record.primary.text = "(Generation Failed or Logic Error)";
            record.primary.structureOk = false;
        }

        // Map Secondary Result
        if (compare) {
            record.secondary = { model: secondaryModelName, text: '', structureOk: false };
            const sOut = secondaryOutputs[i];
            if (sOut) {
                record.secondary.text = JSON.stringify(sOut, null, 2);
                record.secondary.structureOk = true;
                if (judgeRole) {
                    record.secondary.judge = await runJudge(record.secondary.text, judgeRole);
                }
            } else {
                record.secondary.text = "(Generation Failed)";
            }
        }

        records.push(record);
        console.log('Done.');
    }

    // 5. Generate Report
    generateReport(mode, records);
}

/**
 * Runs the model with failover and attempts to parse the Batch Response.
 * Expects { drills: [...] } or { items: [...] }
 */
async function runBatchModel(modelName: string, prompt: { system: string, user: string }, expectedCount: number): Promise<any[]> {
    try {
        const response = await generateWithFailover(prompt.system, prompt.user);

        // Attempt clean JSON parse
        let jsonStr = response.text;
        if (jsonStr.includes('```json')) {
            jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
            jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        }

        const json = JSON.parse(jsonStr);
        const list = json.drills || json.items || json.cards || [];

        if (!Array.isArray(list)) {
            console.warn(`[Warn] Response is not an array wrapped in 'drills'/'items':`, jsonStr.slice(0, 100));
            return [];
        }

        // Return raw objects
        return list;

    } catch (e) {
        console.error(`[Error] Batch Generation Failed: ${(e as Error).message}`);
        return [];
    }
}

async function runJudge(content: string, role: string) {
    // If generation failed, skip judge
    if (!content || content.startsWith('(')) return undefined;

    const systemPrompt = JUDGE_PROMPTS[role];
    const userPrompt = `Evaluate this generated drill content:\n${content}`;

    try {
        const judgeResult = await generateWithFailover(systemPrompt, userPrompt);
        let parseText = judgeResult.text;
        if (parseText.includes('```json')) {
            parseText = parseText.split('```json')[1].split('```')[0].trim();
        }
        return JSON.parse(parseText);
    } catch (e) {
        return { score: 0, reason: "Judge Failed to Parse", suggestion: null };
    }
}

function generateReport(mode: string, records: EvalRecord[]) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

    const filename = path.join(reportDir, `eval-${mode}-${timestamp}.md`);

    let md = `# Evaluation Report: ${mode}\n`;
    md += `**Date**: ${new Date().toLocaleString()}\n`;
    md += `**Total Comparison**: ${records.length} Cases\n\n`;

    // Summary Table of Suggestions
    md += `## 💡 Optimization Suggestions\n`;

    let hasSuggestions = false;
    records.forEach(r => {
        if (r.primary.judge?.suggestion) {
            md += `- [${r.id}] **${r.primary.model}**: ${r.primary.judge.suggestion}\n`;
            hasSuggestions = true;
        }
        if (r.secondary?.judge?.suggestion) {
            md += `- [${r.id}] **${r.secondary.model}**: ${r.secondary.judge.suggestion}\n`;
            hasSuggestions = true;
        }
    });

    if (!hasSuggestions) {
        md += `No specific prompt suggestions (All passed strict checks or judge failed).\n`;
    }
    md += `\n`;

    // Detailed Cases
    records.forEach(r => {
        md += `## Case: ${r.id}\n`;
        md += `> ${r.description}\n\n`;
        md += `**Input**: \`${JSON.stringify(r.input)}\`\n\n`;

        // Comparison Table
        md += `| Dimension | Primary (${r.primary.model}) | Secondary (${r.secondary?.model || 'N/A'}) |\n`;
        md += `|---|---|---|\n`;
        md += `| **Structure** | ${r.primary.structureOk ? '✅' : '❌'} | ${r.secondary ? (r.secondary.structureOk ? '✅' : '❌') : '-'} |\n`;
        if (r.primary.judge) {
            md += `| **Judge Score** | ${r.primary.judge.score}/10 | ${r.secondary?.judge?.score ?? '-'} |\n`;
            md += `| **Reason** | ${r.primary.judge.reason} | ${r.secondary?.judge?.reason ?? '-'} |\n`;
        }
        md += `\n`;

        // Details Collapsible
        md += `<details><summary>View Raw Output</summary>\n\n`;
        md += `### Primary Output\n\`\`\`json\n${r.primary.text}\n\`\`\`\n`;
        if (r.secondary) {
            md += `### Secondary Output\n\`\`\`json\n${r.secondary.text}\n\`\`\`\n`;
        }
        md += `</details>\n\n---\n\n`;
    });

    fs.writeFileSync(filename, md);
    console.log(`\n✅ Report generated: ${filename}`);
}

// ----------------------------------------------------------------------------
// Utils
// ----------------------------------------------------------------------------

function getValue(args: string[], key: string): string | undefined {
    const index = args.indexOf(key);
    if (index > -1 && index + 1 < args.length) {
        return args[index + 1];
    }
    return undefined;
}

async function getGenerator(mode: string) {
    switch (mode) {
        case 'L1_CHUNKING':
            const { getL1ChunkingBatchPrompt } = await import('../lib/generators/l1/chunking');
            return getL1ChunkingBatchPrompt;
        case 'L0_SYNTAX':
            const { getL0SyntaxBatchPrompt } = await import('../lib/generators/l0/syntax');
            return getL0SyntaxBatchPrompt;
        default:
            throw new Error(`Unknown mode: ${mode}`);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
