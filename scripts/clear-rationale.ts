/**
 * 一次性工具脚本：仅清空 QuestionSeed.rationale 字段为空字符串。
 * 不会删除任何行或修改其他字段。
 * 
 * 用法: npx tsx scripts/clear-rationale.ts
 */
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const result = await prisma.questionSeed.updateMany({
            data: { rationale: '' }
        });
        console.log(`✅ 已清空 rationale 字段，影响行数: ${result.count}`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(e => { console.error('❌ 执行失败:', e); process.exit(1); });
