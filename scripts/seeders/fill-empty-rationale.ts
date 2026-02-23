/**
 * 填充空解析脚本
 * 功能：
 *   查找并使用模型（默认 gpt-4o-mini 或 qwen）批量为没有 rationale 的题目生成中文解析
 * 使用方法：
 *   npx tsx scripts/fill-empty-rationale.ts
 * 注意：
 *   1. 环境变量要求：必须有数据库连接配置及相应的 LLM API Key
 *   2. 此脚本采用并发执行机制，直接更新到数据库
 */
import { PrismaClient } from '@prisma/client';
import { generateObject } from 'ai';
import { z } from 'zod';
import { getAIModel } from '../../lib/ai/client';
import { createLogger } from '../../lib/logger';
import { safeParse } from '../../lib/ai/utils';

const log = createLogger('fill-rationale');

const prisma = new PrismaClient();

// Use the default model (e.g. gpt-4o-mini or qwen) for rationale generation
const { model, modelName } = getAIModel('etl');
const CONCURRENCY = 6; // Parallel workers for batch processing
const BATCH_SIZE = 10; // Number of questions per LLM call

async function main() {
    log.info(`🚀 Starting Empty Rationale Filler with model: ${modelName}`);

    // Find all seeds missing rationale or passageContext
    const emptySeeds = await prisma.questionSeed.findMany({
        where: { rationale: '' },
        select: {
            id: true,
            sentence: true,
            targetAnswer: true,
            options: true,
            questionType: true,
            posTested: true,
            grammarNode: { select: { code: true, name: true } }
        }
    });

    if (emptySeeds.length === 0) {
        log.info("✅ No empty rationales found.");
        return;
    }

    log.info(`🔍 Found ${emptySeeds.length} questions needing rationales. Processing in batches of ${BATCH_SIZE} with concurrency ${CONCURRENCY}...`);
    let completed = 0;
    const errors: any[] = [];

    // [B-2 Fix] 使用 generator 函数统一分发批次，避免多 worker 并发 splice 的 race condition
    function* batchIterator(seeds: typeof emptySeeds) {
        while (seeds.length > 0) {
            yield seeds.splice(0, BATCH_SIZE);
        }
    }

    const iter = batchIterator(emptySeeds);

    const worker = async () => {
        while (true) {
            // 从 generator 串行取批次（JS 单线程保证此处无竞争）
            const next = iter.next();
            if (next.done || !next.value) break;
            const batch = next.value;

            try {
                // Prepare content for the prompt
                const mappedBatch = batch.map((q, index) => {
                    const optsArray = q.options as any[];
                    const optsText = Array.isArray(optsArray)
                        ? optsArray.map((o: any, i: number) => `(${String.fromCharCode(65 + i)}) ${o.text}`).join(' ')
                        : '';
                    return `
【Question ${index + 1}】
ID: ${q.id}
题干: ${q.sentence}
选项: ${optsText}
正确答案: ${q.targetAnswer}
已知考点标签: ${q.questionType} (考查词性: ${q.posTested || '无'})
语法节点: ${q.grammarNode ? `${q.grammarNode.code} (${q.grammarNode.name})` : '无'}
`.trim();
                }).join('\n\n');

                const prompt = `
作为专业的 TOEIC 考试老师，请为以下这批 Part 5 题目分别写一段内容详实的中文解析。
要求：
1. 每道题的解析篇幅限制在 100~200 个汉字之间。
2. 必须明确解释为什么正确答案是对的，并且必须逐一指出另外3个干扰项为什么是错的（例如：词性不符、时态错误、句意不通等）。
3. 如果是固定搭配/短语，请列出该短语的中英文。
4. 保持专业和高效，不要写成冗长的教科书式理论说教。
5. 必须严格返回如下 JSON 结构（包含 results 数组），不要输出任何其他内容。绝对不要包含 \`\`\`json 标记，只需返回纯正的 JSON 文本：
{
  "results": [
    {
      "id": "题目ID",
      "rationale": "中文解析..."
    }
  ]
}

# 题目数据：
${mappedBatch}
                `.trim();

                const { object } = await generateObject({
                    model: model,
                    prompt: prompt,
                    temperature: 0.3,
                    schema: z.object({
                        results: z.array(z.object({
                            id: z.string(),
                            rationale: z.string().describe("100~200个汉字的详实中文解析，包含对3个干扰项的排错说明")
                        }))
                    })
                });

                // Update database in a transaction (确保批量写入的原子性)
                await prisma.$transaction(
                    object.results.map((res: { id: string, rationale: string }) =>
                        prisma.questionSeed.update({
                            where: { id: res.id },
                            data: { rationale: res.rationale }
                        })
                    )
                );

                completed += batch.length;
                log.info(`⏳ Progress: ${completed} rationales generated...`);
            } catch (e) {
                log.error(`❌ Failed to generate rationale for batch starting with ID ${batch[0].id}: ${e}`);
                batch.forEach(q => errors.push(q.id));
            }
        }
    };

    // Run workers concurrently
    const workers = Array.from({ length: CONCURRENCY }).map(() => worker());
    await Promise.all(workers);

    log.info(`\n🎉 Rationale Generation Complete!`);
    log.info(`✅ Success: ${completed}`);
    log.info(`❌ Failed : ${errors.length}`);
    if (errors.length > 0) {
        log.error(`Failed IDs: ${errors.join(', ')}`);
    }
}

main()
    .catch(e => {
        log.error({ err: e }, "Fatal error");
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
