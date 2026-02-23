/**
 * 种子打标脚本：批量为 QuestionSeed 补充 grammarNodeId
 *
 * 用法：
 *   npx tsx scripts/seeders/tag-question-seeds.ts          # Dry-run 模式（默认，不写库）
 *   npx tsx scripts/seeders/tag-question-seeds.ts --commit  # 正式写入数据库
 *
 * 审计修复清单：
 *   [B1] 使用 getAIModel('etl') 统一走项目 AI 工厂
 *   [B2] 使用 Prisma 枚举类型，移除 as any
 *   [W1] LLM 返回 code 而非 cuid，防幻觉
 *   [W2] 批量模式 (BATCH_SIZE=10)，效率提升 10x
 *   [W3] 全量打标，移除题型过滤
 */

import { PrismaClient, QuestionType } from '@prisma/client';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getAIModel } from '../../lib/ai/client';
import { createLogger } from '../../lib/logger';
import {
    GRAMMAR_TAGGER_SYSTEM_PROMPT,
    buildTaggerUserPrompt,
    GrammarTagBatchResultSchema,
    type TaxonomyNode,
    type QuestionForTagging,
} from '../../lib/generators/etl/grammar-tagger-prompt';

const log = createLogger('grammar-tagger');
const prisma = new PrismaClient();

// [B1] 使用项目统一的 AI 工厂
const { model, modelName } = getAIModel('etl');

const BATCH_SIZE = 5;
const CONCURRENCY = 5;

// Dry-run 模式：默认不写库，加 --commit 才写
const DRY_RUN = !process.argv.includes('--commit');

async function main() {
    log.info(`🚀 Grammar Tagger starting (model: ${modelName}, dry-run: ${DRY_RUN})`);

    // 1. 获取所有 L3 节点 (code → id 映射)
    const l3Nodes = await prisma.grammarNode.findMany({
        where: { level: 3 },
        select: { id: true, code: true, name: true, description: true },
    });

    if (l3Nodes.length === 0) {
        log.error('No L3 GrammarNodes found. Run seed-grammar-nodes.ts first.');
        process.exit(1);
    }

    // [W1] code → id 映射表，LLM 只返回 code
    const codeToId = new Map(l3Nodes.map(n => [n.code, n.id]));
    const taxonomyForPrompt: TaxonomyNode[] = l3Nodes.map(n => ({
        code: n.code, name: n.name, description: n.description,
    }));

    // 2. [W3] 全量查询，不过滤题型，但过滤掉已被打标的
    const pendingQuestions = await prisma.questionSeed.findMany({
        where: { isGrammarTagged: false },
        select: {
            id: true, sentence: true, targetAnswer: true,
            questionType: true, options: true, rationale: true,
        },
    });

    log.info(`📋 Found ${pendingQuestions.length} untagged questions`);
    if (pendingQuestions.length === 0) { log.info('✅ All done!'); return; }

    // 3. [W2] 批量分组
    const batches: QuestionForTagging[][] = [];
    for (let i = 0; i < pendingQuestions.length; i += BATCH_SIZE) {
        batches.push(pendingQuestions.slice(i, i + BATCH_SIZE));
    }

    log.info(`📦 Split into ${batches.length} batches of ${BATCH_SIZE}`);

    let successCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    // [W2] Generator 分发批次（参考 fill-empty-rationale.ts 模式）
    function* batchIterator() {
        for (let i = 0; i < batches.length; i++) {
            yield { batch: batches[i], index: i };
        }
    }

    const iter = batchIterator();

    const worker = async () => {
        while (true) {
            const next = iter.next();
            if (next.done || !next.value) break;
            const { batch, index: batchIndex } = next.value;

            try {
                const userPrompt = buildTaggerUserPrompt(taxonomyForPrompt, batch);

                const { object } = await generateObject({
                    model: model,
                    system: GRAMMAR_TAGGER_SYSTEM_PROMPT,
                    prompt: userPrompt,
                    schema: GrammarTagBatchResultSchema,
                    temperature: 0.1, // 低温度确保确定性
                });

                // 处理每条结果 (schema 现在是裸数组)
                for (const item of object) {
                    let nodeId: string | null = null;

                    if (item.grammarNodeCode === 'NULL') {
                        skippedCount++;
                    } else {
                        nodeId = codeToId.get(item.grammarNodeCode) || null;
                        if (!nodeId) {
                            log.warn(`⚠️ Invalid code from LLM: ${item.grammarNodeCode} (question: ${item.id})`);
                            failedCount++;
                            continue;
                        }
                    }

                    if (DRY_RUN) {
                        // Dry-run：只打印，不写库
                        log.info(`[DRY] ${item.id} → ${item.grammarNodeCode} (${item.reason})`);
                        successCount++;
                    } else {
                        // 无论匹配成功还是 NULL，都标记为已处理
                        const dataToUpdate: any = { isGrammarTagged: true };
                        if (item.grammarNodeCode !== 'NULL' && nodeId) {
                            dataToUpdate.grammarNodeId = nodeId;
                        }

                        await prisma.questionSeed.update({
                            where: { id: item.id },
                            data: dataToUpdate,
                        });
                        successCount++;
                    }
                }

                const progress = `[${batchIndex + 1}/${batches.length}]`;
                log.info(`${progress} ✅ Batch done. Running total: ${successCount} tagged, ${skippedCount} skipped`);

            } catch (err: any) {
                failedCount += batch.length;
                log.error(`❌ Batch ${batchIndex + 1} failed: ${err.message}`);

                // 🛡️ [The Guardian Patch]: BATCH FALLBACK
                // 即便 AI 生成崩溃（比如请求超时、JSON格式炸裂），也要把这块数据标记掉，防止毒丸阻塞通道！
                if (!DRY_RUN) {
                    try {
                        const failedIds = batch.map(b => b.id);
                        await prisma.questionSeed.updateMany({
                            where: { id: { in: failedIds } },
                            data: {
                                isGrammarTagged: true, // 必须释放占用
                                grammarNodeId: null    // 暂作跳过处理
                            }
                        });
                        log.warn(`⚠️ Applied Fallback to ${failedIds.length} failed items.`);
                    } catch (fallbackErr) {
                        log.error(`🚨 CRITICAL: Fallback also failed! DB connection issue?`);
                    }
                }
            }
        }
    };

    // 并发执行
    const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
    await Promise.all(workers);

    log.info(`\n🎉 Tagging complete!`);
    log.info(`✅ Tagged: ${successCount} | ⏭️ Skipped (NULL): ${skippedCount} | ❌ Failed: ${failedCount}`);
    if (DRY_RUN) {
        log.info(`⚠️ DRY-RUN mode — no data was written. Use --commit to persist.`);
    }
}

main()
    .catch(e => { log.error({ err: e }, 'Fatal error'); process.exit(1); })
    .finally(() => prisma.$disconnect());
