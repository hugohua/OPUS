import { PrismaClient } from '@prisma/client';
import { generateText } from 'ai';
import { getAIModel } from '../lib/ai/client';
import { createLogger } from '../lib/logger';

const log = createLogger('fill-rationale');

const prisma = new PrismaClient();

// Use the default model (e.g. gpt-4o-mini or qwen) for rationale generation
// because it's a simple translation/explanation task, no need for expensive Gemini.
const { model, modelName } = getAIModel('default');
const CONCURRENCY = 10; // Simple task, can run high concurrency

async function main() {
    log.info(`🚀 Starting Empty Rationale Filler with model: ${modelName}`);

    // Find all seeds missing rationale or passageContext
    const emptySeeds = await prisma.questionSeed.findMany({
        where: { rationale: '' },
        select: { id: true, sentence: true, targetAnswer: true, options: true, questionType: true, posTested: true }
    });

    if (emptySeeds.length === 0) {
        log.info("✅ No empty rationales found.");
        return;
    }

    log.info(`🔍 Found ${emptySeeds.length} questions needing rationales. Processing with concurrency ${CONCURRENCY}...`);
    let completed = 0;
    const errors: any[] = [];

    const worker = async () => {
        while (emptySeeds.length > 0) {
            const q = emptySeeds.shift();
            if (!q) break;

            try {
                // Options display for prompt
                const optsArray = q.options as any[];
                const optsText = Array.isArray(optsArray)
                    ? optsArray.map((o: any, i: number) => `(${String.fromCharCode(65 + i)}) ${o.text}`).join(' ')
                    : '';

                const prompt = `
作为专业的 TOEIC 考试老师，请为以下这道 Part 5 题目写一段简短精炼的中文解析。
要求：
1. 篇幅限制在 50~80 个汉字之间。必须一语中的，严禁长篇大论的语法说教。
2. 直接讲出考点和为什么选这个答案。
3. 如果是固定搭配/短语，请列出该短语的中英文。
4. 绝对不要返回任何其他内容或解释，只返回中文解析这段话本身。

# 题目数据：
【题干】${q.sentence}
【选项】${optsText}
【正确答案】${q.targetAnswer}
【已知考点标签】${q.questionType} (考查词性: ${q.posTested || '无'})
                `.trim();

                const { text } = await generateText({
                    model: model,
                    prompt: prompt,
                    temperature: 0.3
                });

                await prisma.questionSeed.update({
                    where: { id: q.id },
                    data: { rationale: text.trim() }
                });

                completed++;
                if (completed % 10 === 0) {
                    log.info(`⏳ Progress: ${completed} rationales generated...`);
                }
            } catch (e) {
                log.error(`❌ Failed to generate rationale for ID ${q.id}: ${e}`);
                errors.push(q.id);
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
