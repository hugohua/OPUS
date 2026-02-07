/**
 * LLM Prompt 评估运行脚本 (Evaluation Runner)
 * 
 * [功能描述]
 * 用于评估 L0-L2 Prompt 质量的统一 CLI 工具。
 * 支持 "Golden Set" (回归测试) 和 "Wild Set" (动态测试) 两种模式。
 * 
 * [使用模式 Usage Modes]
 * 
 * 1. 🟢 静态模式 STATIC MODE (Golden Set) - 默认
 *    用于【回归测试】。确保已知的经典 Case 不会劣化。
 *    > npx tsx scripts/eval-prompts.ts --mode L0_SYNTAX --judge ets-auditor
 *    > npx tsx scripts/eval-prompts.ts --mode L0_PHRASE --judge ets-auditor
 *    > npx tsx scripts/eval-prompts.ts --mode L0_BLITZ --judge ets-auditor
 * 
 * 2. 🟠 动态模式 DYNAMIC MODE (Wild Set) - 使用 "--source db"
 *    用于【覆盖率测试】。随机从数据库抽取 10 条数据，测试 Prompt 对未知数据的鲁棒性。
 *    > npx tsx scripts/eval-prompts.ts --mode L0_SYNTAX --source db --judge ets-auditor
 * 
 * 3. 🔵 汇总模式 SUMMARY MODE (Meta-Analysis)
 *    用于【生成分析报告】。在运行单项评估通过后，生成跨场景的执行摘要 (使用 ETL_MODEL)。
 *    > npx tsx scripts/eval-prompts.ts --summary
 * 
 * 4. 🟣 对比模式 COMPARISON MODE (A/B Test)
 *    对比当前模型 (AI_MODEL_NAME) 与 候选模型 (ETL_MODEL_NAME) 的表现。
 *    > npx tsx scripts/eval-prompts.ts --mode L0_SYNTAX --compare --judge ets-auditor
 * 
 * [最佳实践 Best Practices]
 * - CI/CD Pipeline: 每日运行 🟢 静态模式。
 * - 发版前 (Pre-Release): 运行 🟠 动态模式 (Wild Set) 捕捉边界情况。
 * - Prompt 重构优化: 运行 🔵 汇总模式 获取可执行的优化建议。
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AIService } from '../lib/ai/core';
import { JUDGE_PROMPTS } from '../lib/generators/judges';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----------------------------------------------------------------------------
// Types & Constants
// ----------------------------------------------------------------------------



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
    const generateSummary = args.includes('--summary');

    // Special mode: Generate cross-scenario summary
    if (generateSummary) {
        await generateCrossScenarioSummary();
        return;
    }

    if (!mode) {
        console.log('Usage:');
        console.log('  Single scenario: npx tsx scripts/eval-prompts.ts --mode <MODE> [--compare] [--judge <ROLE>]');
        console.log('  Cross-scenario summary: npx tsx scripts/eval-prompts.ts --summary');
        process.exit(1);
    }

    console.log(`\n🚀 Starting Evaluation: [${mode}] ${compare ? '(Multi-Model Comparison)' : ''}`);

    // 1. Load Dataset
    let testCases: any[] = [];
    const sourceArg = getValue(args, '--source') || 'json';

    if (sourceArg === 'db') {
        console.log('📦 Source: Database (is_toeic_core=true)');
        testCases = await fetchTestCasesFromDB(mode);
    } else {
        console.log('📂 Source: Local JSON File');
        const datasetPath = path.resolve(process.cwd(), `tests/evals/${mode.toLowerCase().replace(/_/g, '-')}.json`);
        if (!fs.existsSync(datasetPath)) {
            console.error(`❌ Dataset not found at: ${datasetPath}`);
            process.exit(1);
        }
        testCases = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    }

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
        const originalOrder = process.env.AI_FAST_ORDER;
        // Force OpenRouter (or secondary) for comparison
        process.env.AI_FAST_ORDER = 'openrouter';
        console.log(`[Secondary] Calling ${secondaryModelName} with ${inputs.length} items...`);

        secondaryOutputs = await runBatchModel(secondaryModelName, prompt, inputs.length);
        console.log(`[Secondary] Received ${secondaryOutputs.length} valid items.`);

        process.env.AI_FAST_ORDER = originalOrder;
    }

    // 4. Map & Judge
    console.log('\n--- Grading & Judging ---');
    const records: EvalRecord[] = [];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];

        // For DB items, id might be number, ensure string
        const caseId = testCase.id ? String(testCase.id) : `db_case_${i + 1}`;
        const description = testCase.description || `DB Word: ${testCase.input.targetWord || 'Unknown'}`;

        const record: EvalRecord = {
            id: caseId,
            description: description,
            input: testCase.input,
            primary: { model: primaryModelName, text: '', structureOk: false }
        };

        process.stdout.write(`Evaluating ${caseId}... `);

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
    generateReport(mode, records, prompt.system);
}


// ----------------------------------------------------------------------------
// Database Fetcher
// ----------------------------------------------------------------------------

async function fetchTestCasesFromDB(mode: string): Promise<any[]> {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
        if (mode === 'L0_SYNTAX') {
            // 1. Fetch Words
            const coreConnectWords = await prisma.vocab.findMany({
                where: { is_toeic_core: true },
                take: 50, // Fetch pool
                orderBy: { frequency_score: 'desc' } // Prioritize high freq
            });

            if (coreConnectWords.length === 0) {
                console.warn('⚠️ No core words found in DB.');
                return [];
            }

            // Shuffle and pick 10
            const selected = coreConnectWords.sort(() => 0.5 - Math.random()).slice(0, 10);

            return selected.map(w => {
                // Map wordFamily safety
                let wf = { v: null, n: null, adj: null, adv: null };
                try {
                    if (w.word_family && typeof w.word_family === 'object') {
                        wf = { ...wf, ...(w.word_family as any) };
                    }
                } catch { }

                // Context words strategy
                let contextWords: string[] = [];
                try {
                    // Try to harvest from collocations
                    if (Array.isArray(w.collocations)) {
                        const cols = w.collocations as any[];
                        if (cols.length > 0) {
                            // Extract simplistic approach: randomly pick one col, split space, filter small
                            const text = cols[0].text || "";
                            contextWords = text.split(' ')
                                .filter((t: string) => t.length > 3 && t.toLowerCase() !== w.word.toLowerCase())
                                .slice(0, 2);
                        }
                    }
                } catch { }

                // Fallback context: Pick 2 random other DB words
                if (contextWords.length === 0) {
                    const others = coreConnectWords
                        .filter(dw => dw.id !== w.id)
                        .sort(() => 0.5 - Math.random())
                        .slice(0, 2)
                        .map(dw => dw.word);
                    contextWords = others;
                }

                return {
                    id: `db_${w.word}`,
                    description: `[DB] ${w.word} (${w.definition_cn || 'No Def'})`,
                    input: {
                        targetWord: w.word,
                        meaning: w.definition_cn || (w.definitions as any)?.business_cn || "Unknown",
                        contextWords: contextWords,
                        wordFamily: wf
                    }
                };
            });
        }

        if (mode === 'L0_PHRASE') {
            // Fetch words with Collocations
            const validWords = await prisma.vocab.findMany({
                where: {
                    is_toeic_core: true,
                    // Ensure we have collocations to make phrases
                    collocations: { not: [] as any }
                },
                take: 50,
                orderBy: { frequency_score: 'desc' }
            });

            const selected = validWords.sort(() => 0.5 - Math.random()).slice(0, 10);

            return selected.map(w => {
                let collocations: string[] = [];
                try {
                    const cols = w.collocations as any[];
                    // Pick collocations that contain the target word
                    collocations = cols.map(c => c.text).filter(t => t.toLowerCase().includes(w.word.toLowerCase())).slice(0, 2);
                } catch { }

                if (collocations.length === 0) collocations = [`make ${w.word}`]; // Fallback

                return {
                    id: `db_phrase_${w.word}`,
                    description: `[DB] Phrase for ${w.word}`,
                    input: {
                        targetWord: w.word,
                        modifiers: collocations
                    }
                };
            });
        }

        if (mode === 'L0_BLITZ') {
            const validWords = await prisma.vocab.findMany({
                where: { is_toeic_core: true },
                take: 50
            });

            const selected = validWords.sort(() => 0.5 - Math.random()).slice(0, 10);

            return selected.map(w => {
                let cols: string[] = [];
                try {
                    cols = (w.collocations as any[]).map(c => c.text).slice(0, 3);
                } catch { }

                return {
                    id: `db_blitz_${w.word}`,
                    description: `[DB] Blitz for ${w.word}`,
                    input: {
                        targetWord: w.word,
                        meaning: w.definition_cn || 'Unknown',
                        collocations: cols
                    }
                };
            });
        }

        if (mode === 'L1_CHUNKING') {
            // Fetch sentences from commonExample
            const validWords = await prisma.vocab.findMany({
                where: {
                    is_toeic_core: true,
                    commonExample: { not: null }
                },
                take: 50
            });

            const selected = validWords.sort(() => 0.5 - Math.random()).slice(0, 5);

            return selected.map(w => ({
                id: `db_chunk_${w.word}`,
                description: `[DB] Sentence for ${w.word}`,
                input: {
                    sentence: w.commonExample,
                    targetWord: w.word
                }
            }));
        }

        console.warn(`DB Fetch not implemented for mode: ${mode}`);
        return [];

    } finally {
        await prisma.$disconnect();
    }
}

/**
 * Runs the model with failover and attempts to parse the Batch Response.
 * Expects { drills: [...] } or { items: [...] }
 */
async function runBatchModel(modelName: string, prompt: { system: string, user: string }, expectedCount: number): Promise<any[]> {
    try {
        const response = await AIService.generateText({
            system: prompt.system,
            prompt: prompt.user,
            mode: 'fast'
        });

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
        const judgeResult = await AIService.generateText({
            system: systemPrompt,
            prompt: userPrompt,
            mode: 'smart'
        });
        let parseText = judgeResult.text;
        if (parseText.includes('```json')) {
            parseText = parseText.split('```json')[1].split('```')[0].trim();
        }
        return JSON.parse(parseText);
    } catch (e) {
        return { score: 0, reason: "Judge Failed to Parse", suggestion: null };
    }
}

function generateReport(mode: string, records: EvalRecord[], systemPrompt: string) {
    const stats = calculateStats(records);
    generateHTMLReport(mode, records, stats);
    generateMarkdownReport(mode, records, stats);
    generateManualJudgePrompt(mode, records, systemPrompt);
}

function generateHTMLReport(mode: string, records: EvalRecord[], stats: any) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

    const filename = path.join(reportDir, `eval-${mode}-${timestamp}.html`);

    const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prompt 评估报告: ${mode}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Microsoft YaHei", Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f6f8fa; }
        h1, h2, h3 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
        .header { background: #ffffff; padding: 20px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #fff; padding: 15px; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); text-align: center; border: 1px solid #e1e4e8; }
        .stat-value { font-size: 24px; font-weight: bold; color: #0366d6; }
        .stat-label { font-size: 14px; color: #586069; margin-top: 5px; }
        .summary-box { background: #e6ffed; border: 1px solid #acf2bd; padding: 15px; border-radius: 6px; margin-bottom: 20px; }
        .case-card { background: #ffffff; border: 1px solid #e1e4e8; border-radius: 6px; margin-bottom: 20px; padding: 20px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .case-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .case-id { font-family: monospace; font-weight: bold; background: #f1f8ff; padding: 2px 6px; border-radius: 4px; color: #0366d6; }
        .case-desc { color: #586069; font-style: italic; }
        .comparison-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .comparison-table th, .comparison-table td { border: 1px solid #dfe2e5; padding: 8px 12px; text-align: left; vertical-align: top; }
        .comparison-table th { background-color: #f6f8fa; width: 150px; }
        .judge-pass { color: #2ea44f; font-weight: bold; }
        .judge-fail { color: #cb2431; font-weight: bold; }
        pre { background: #f6f8fa; padding: 10px; border-radius: 6px; overflow-x: auto; font-size: 13px; margin: 0; }
        details { margin-top: 10px; cursor: pointer; }
        summary { color: #0366d6; outline: none; }
        .suggestion { background: #fffbdd; border-left: 4px solid #f9c513; padding: 10px; margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Prompt 评估报告: ${mode}</h1>
        <p><strong>生成时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
        <p><strong>测试用例总数:</strong> ${records.length}</p>
    </div>

    ${renderStats(stats)}
    ${generateSummarySection(records)}
    ${records.map(renderCaseCard).join('\n')}

</body>
</html>
    `;

    fs.writeFileSync(filename, htmlContent);
    console.log(`\n✅ 报告已生成 (HTML): ${filename}`);
}

function generateMarkdownReport(mode: string, records: EvalRecord[], stats: any) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

    const filename = path.join(reportDir, `eval-${mode}-${timestamp}.md`);

    let md = `# Evaluation Report: ${mode}\n`;
    md += `**Date**: ${new Date().toLocaleString('zh-CN')}\n`;
    md += `**Total Cases**: ${records.length}\n\n`;

    md += `## 📊 Core Metrics\n`;
    md += `- **Structure Pass Rate**: ${stats.structureRate}%\n`;
    md += `- **Average Score**: ${stats.avgScore}\n`;
    md += `- **Quality Rate (>=7)**: ${stats.qualityRate !== 'N/A' ? stats.qualityRate + '%' : 'N/A'}\n\n`;

    // Suggestions
    let hasSuggestions = false;
    let suggestionText = `## 💡 Optimization Suggestions\n`;
    records.forEach(r => {
        if (r.primary.judge?.suggestion) {
            suggestionText += `- [${r.id}] **${r.primary.model}**: ${r.primary.judge.suggestion}\n`;
            hasSuggestions = true;
        }
        if (r.secondary?.judge?.suggestion) {
            suggestionText += `- [${r.id}] **${r.secondary.model}**: ${r.secondary.judge.suggestion}\n`;
            hasSuggestions = true;
        }
    });

    if (hasSuggestions) {
        md += suggestionText + '\n';
    }

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

        // Raw Output
        md += `<details><summary>View Raw Output</summary>\n\n`;
        md += `### Primary Output\n\`\`\`json\n${r.primary.text}\n\`\`\`\n`;
        if (r.secondary) {
            md += `### Secondary Output\n\`\`\`json\n${r.secondary.text}\n\`\`\`\n`;
        }
        md += `</details>\n\n---\n\n`;
    });

    fs.writeFileSync(filename, md);
    console.log(`✅ 报告已生成 (MD): ${filename}`);
}

function generateManualJudgePrompt(mode: string, records: EvalRecord[], systemPrompt: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const reportDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);

    const filename = path.join(reportDir, `eval-${mode}-${timestamp}-judge-prompts.md`);

    let content = `# Manual Judge Prompts (${mode})\n\n`;
    content += `> Generated at ${new Date().toLocaleString('zh-CN')}\n`;
    content += `> Copy blocks below to Claude 3.5 Sonnet / GPT-4o for manual auditing.\n\n`;

    records.forEach((r, index) => {
        const inputJson = JSON.stringify(r.input, null, 2);
        const outputJson = r.primary.structureOk ? r.primary.text : "(Generation Failed)";

        content += `---
## Case ${index + 1}: ${r.id} (${r.description})

# QA Evaluation Prompt

Please act as a **Strict Data Auditor & Linguistic Expert**.
Your task is to evaluate the quality of the "Result" generated by an AI model, based on the specific "System Prompt" and "User Prompt" provided below.

---

## 1. Context (The Task)

### System Prompt (The Rules):
${systemPrompt}

### User Prompt (The Input):
${inputJson}

---

## 2. The Result to Evaluate (AI Output)

### Result:
${outputJson}

---

## 3. Evaluation Task (Your Job)

Please analyze the "Result" above and provide a structured report covering:

1.  **Rule Compliance Check**:
    * Did the AI output strict JSON without markdown or extra text?
    * Did it respect all constraints in the System Prompt?

2.  **Linguistic Quality Check**:
    * **Tone**: Is it appropriate for the context?
    * **Accuracy**: Are the generated sentences/options correct?
    * **Distractors**: Are they plausible but incorrect?

3.  **Overall Score**:
    * Give a score from 1-10.
    * State if this data is "Production Ready" or "Needs Revision".

**Output your analysis below:**

\`\`\`
(Paste analysis here)
\`\`\`

\n\n`;
    });

    fs.writeFileSync(filename, content);
    console.log(`✅ 质检 Prompt 已生成: ${filename}`);
}

function calculateStats(records: EvalRecord[]) {
    const total = records.length;
    const structureOk = records.filter(r => r.primary.structureOk).length;

    let totalScore = 0;
    let scoredCount = 0;
    let highQuality = 0;

    records.forEach(r => {
        if (r.primary.judge?.score) {
            totalScore += r.primary.judge.score;
            scoredCount++;
            if (r.primary.judge.score >= 7) highQuality++;
        }
    });

    return {
        total,
        structureRate: Math.round((structureOk / total) * 100),
        avgScore: scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : 'N/A',
        qualityRate: scoredCount > 0 ? Math.round((highQuality / scoredCount) * 100) : 'N/A'
    };
}

function renderStats(stats: any) {
    return `
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value" style="color: ${stats.structureRate === 100 ? '#2ea44f' : '#d73a49'}">
                ${stats.structureRate}%
            </div>
            <div class="stat-label">结构通过率</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.avgScore}</div>
            <div class="stat-label">平均质量分</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">
                ${stats.qualityRate !== 'N/A' ? `${stats.qualityRate}%` : 'N/A'}
            </div>
            <div class="stat-label">优良率 (≥7分)</div>
        </div>
    </div>
    `;
}

function generateSummarySection(records: EvalRecord[]): string {
    const suggestions = records.flatMap(r => {
        const list = [];
        if (r.primary.judge?.suggestion) list.push({ id: r.id, model: r.primary.model, text: r.primary.judge.suggestion });
        if (r.secondary?.judge?.suggestion) list.push({ id: r.id, model: r.secondary.model, text: r.secondary.judge.suggestion });
        return list;
    });

    if (suggestions.length === 0) return '';

    return `
    <div class="header">
        <h2>💡 优化建议汇总</h2>
        <ul>
            ${suggestions.map(s => `<li>[<strong>${s.id}</strong>] ${s.model}: ${s.text}</li>`).join('')}
        </ul>
    </div>
    `;
}

function renderCaseCard(r: EvalRecord): string {
    const primaryJudge = r.primary.judge ?
        `<span class="${r.primary.judge.score >= 7 ? 'judge-pass' : 'judge-fail'}">${r.primary.judge.score}/10</span>` : '-';

    const secondaryJudge = r.secondary?.judge ?
        `<span class="${r.secondary.judge.score >= 7 ? 'judge-pass' : 'judge-fail'}">${r.secondary.judge.score}/10</span>` : '-';

    return `
    <div class="case-card">
        <div class="case-header">
            <div>
                <span class="case-id">${r.id}</span>
                <span class="case-desc">${r.description}</span>
            </div>
            <div>结构校验: ${r.primary.structureOk ? '✅ 通过' : '❌ 失败'}</div>
        </div>

        <div style="margin-bottom: 10px;">
            <strong>输入数据:</strong>
            <pre>${JSON.stringify(r.input, null, 2)}</pre>
        </div>

        <table class="comparison-table">
            <thead>
                <tr>
                    <th>评估维度</th>
                    <th>主模型 (${r.primary.model})</th>
                    ${r.secondary ? `<th>对比模型 (${r.secondary.model})</th>` : ''}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>裁判评分</strong></td>
                    <td>${primaryJudge}</td>
                    ${r.secondary ? `<td>${secondaryJudge}</td>` : ''}
                </tr>
                <tr>
                    <td><strong>评分理由</strong></td>
                    <td>${r.primary.judge?.reason || '-'}</td>
                    ${r.secondary ? `<td>${r.secondary.judge?.reason || '-'}</td>` : ''}
                </tr>
                ${renderSuggestionRow(r)}
            </tbody>
        </table>

        <details>
            <summary>查看原始输出 JSON</summary>
            <div style="display: grid; grid-template-columns: 1fr ${r.secondary ? '1fr' : ''}; gap: 20px; margin-top: 10px;">
                <div>
                    <h4>主模型输出</h4>
                    <pre>${r.primary.text}</pre>
                </div>
                ${r.secondary ? `
                <div>
                    <h4>对比模型输出</h4>
                    <pre>${r.secondary.text}</pre>
                </div>` : ''}
            </div>
        </details>
    </div>
    `;
}

function renderSuggestionRow(r: EvalRecord): string {
    if (!r.primary.judge?.suggestion && !r.secondary?.judge?.suggestion) return '';
    return `
    <tr>
        <td><strong>改进建议</strong></td>
        <td><div class="suggestion">${r.primary.judge?.suggestion || ''}</div></td>
        ${r.secondary ? `<td><div class="suggestion">${r.secondary.judge?.suggestion || ''}</div></td>` : ''}
    </tr>
    `;
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
        case 'L0_PHRASE':
            const { getL0PhraseBatchPrompt } = await import('../lib/generators/l0/phrase');
            return getL0PhraseBatchPrompt;
        case 'L0_BLITZ':
            const { getL0BlitzBatchPrompt } = await import('../lib/generators/l0/blitz');
            return getL0BlitzBatchPrompt;
        default:
            throw new Error(`Unknown mode: ${mode}`);
    }
}

// ----------------------------------------------------------------------------
// Cross-Scenario Summary Generation
// ----------------------------------------------------------------------------

async function generateCrossScenarioSummary() {
    console.log('\n🔍 Generating Cross-Scenario Summary Report...\n');

    const reportDir = path.resolve(__dirname, '../reports');
    const scenarios = ['L0_SYNTAX', 'L0_PHRASE', 'L0_BLITZ'];
    const summaryData: any = { scenarios: [] };

    // 1. Find and read latest reports for each scenario
    for (const mode of scenarios) {
        console.log(`[${mode}] Looking for latest report...`);

        const files = fs.readdirSync(reportDir)
            .filter(f => f.startsWith(`eval-${mode}-`) && f.endsWith('.md') && !f.includes('judge-prompts'))
            .sort()
            .reverse();

        if (files.length === 0) {
            console.warn(`⚠️  No report found for ${mode}, skipping...`);
            continue;
        }

        const latestFile = files[0];
        const filePath = path.join(reportDir, latestFile);
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse metrics from markdown
        const structureMatch = content.match(/Structure Pass Rate[*:]+\s*(\d+)%/);
        const avgScoreMatch = content.match(/Average Score[*:]+\s*([\d.]+)/);
        const qualityRateMatch = content.match(/Quality Rate[^:]+:\s*(\d+)%/);
        const totalCasesMatch = content.match(/Total Cases[*:]+\s*(\d+)/);

        const scenarioData: any = {
            mode,
            totalCases: totalCasesMatch ? parseInt(totalCasesMatch[1]) : 0,
            structurePass: structureMatch ? parseInt(structureMatch[1]) : 0,
            avgScore: avgScoreMatch ? parseFloat(avgScoreMatch[1]) : 0,
            qualityRate: qualityRateMatch ? parseInt(qualityRateMatch[1]) : 0,
            reports: []
        };

        // Extract individual case evaluations
        const caseRegex = /## Case: ([^\n]+)[\s\S]*?Judge Score[*:]+\s*([\d.]+)\/10[\s\S]*?Reason[*:]+\s*([^\n]+)[\s\S]*?suggestion[*:]+\s*([^\n]+)/gi;
        let match;
        while ((match = caseRegex.exec(content)) !== null) {
            scenarioData.reports.push({
                id: match[1].trim(),
                score: parseFloat(match[2]),
                reason: match[3].trim(),
                suggestion: match[4].trim()
            });
        }

        summaryData.scenarios.push(scenarioData);
        console.log(`  ✓ Loaded ${scenarioData.reports.length} cases from ${latestFile}`);
    }

    if (summaryData.scenarios.length === 0) {
        console.error('❌ No reports found! Please run evaluations first.');
        process.exit(1);
    }

    // 2. Call ETL_MODEL to analyze
    console.log('\n--- Generating Summary via ETL Model ---');
    const etlModel = process.env.ETL_MODEL_NAME || 'openrouter';
    console.log(`Using model: ${etlModel}\n`);

    const systemPrompt = JUDGE_PROMPTS['summary-analyst'];
    const userPrompt = `Analyze the following evaluation data and generate a comprehensive baseline report:

\`\`\`json
${JSON.stringify(summaryData, null, 2)}
\`\`\`

Generate a complete Markdown document following the specified format.`;

    let summaryMarkdown: string;
    try {
        const result = await AIService.generateText({
            system: systemPrompt,
            prompt: userPrompt,
            mode: 'smart' // Summary generation needs reasoning
        });
        summaryMarkdown = result.text;

        // Clean up markdown code blocks if present
        if (summaryMarkdown.includes('```markdown')) {
            summaryMarkdown = summaryMarkdown.split('```markdown')[1].split('```')[0].trim();
        } else if (summaryMarkdown.includes('```')) {
            summaryMarkdown = summaryMarkdown.split('```')[1].split('```')[0].trim();
        }
    } catch (error) {
        console.error('❌ Summary generation failed:', error);
        process.exit(1);
    }

    // 3. Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const outputPath = path.join(reportDir, `baseline-l0-summary-${timestamp}.md`);
    fs.writeFileSync(outputPath, summaryMarkdown, 'utf-8');

    console.log(`\n✅ Summary report generated: ${outputPath}`);
    console.log(`\n📊 Summary Stats:`);
    summaryData.scenarios.forEach((s: any) => {
        console.log(`  ${s.mode}: ${s.avgScore.toFixed(1)}/10 (${s.structurePass}% structure pass)`);
    });
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
