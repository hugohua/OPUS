/**
 * 文章生成流程验证脚本
 * 
 * 功能：
 *   验证 generateDailyArticle Action 的完整流程，包括：
 *   1. 选词 (Target + Context)
 *   2. Prompt 构建与 AI 调用
 *   3. 数据库事务入库 (Article + ArticleVocab)
 * 
 * 使用方法：
 *   npx tsx scripts/test-article-generation.ts
 * 
 * ⚠️ 注意：
 *   1. 需要确保 .env 中配置了有效的 AI API Key (OPENAI/GOOGLE)。
 *   2. 由于使用了 'server-only' 包，直接运行此脚本可能会报错。
 *      请在 `actions/article.ts` 和依赖服务中临时注释掉 `import 'server-only';`。
 */
import { generateDailyArticleAction } from '@/actions/article';
import { db as prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';

// Load Env
try { process.loadEnvFile(); } catch (e) { }

const log = createLogger('test:article-generation');

async function main() {
    log.info('Starting article generation test...');

    try {
        // 调用 Server Action
        const result = await generateDailyArticleAction({ userId: 'test-user-1' });

        if (result.status === 'success' && result.data) {
            console.log('\n✅ Article Generated Successfully:');
            console.log('-----------------------------------');
            console.log(`Title:    ${result.data.title}`);
            console.log(`Summary:  ${result.data.summaryZh}`);
            console.log(`Words:    Target + ${result.data.body.reduce((acc, p) => acc + p.highlights.length, 0)} highlights`);
            console.log('-----------------------------------');
            console.log('Body Preview:');
            result.data.body.forEach((p, i) => {
                console.log(`\n[Para ${i + 1}] ${p.paragraph.substring(0, 100)}...`);
                console.log(`> Highlights: ${p.highlights.join(', ')}`);
            });
            console.log('-----------------------------------\n');
        } else {
            console.log('\n❌ Generation Failed:', result.message);
            if (result.fieldErrors) {
                console.log('Field Errors:', result.fieldErrors);
            }
        }

    } catch (error) {
        log.error(error, 'Test failed');
    } finally {
        await prisma.$disconnect();
    }
}

main();
