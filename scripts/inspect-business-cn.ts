/**
 * 检查脚本：分析 business_cn 字段分布
 */

try { process.loadEnvFile(); } catch (e) { }

import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
    const words = await prisma.vocab.findMany({
        where: { definition_cn: { not: null } },
        select: { word: true, definitions: true }
    });

    let hasBusinessCn = 0;
    let nullBusinessCn = 0;
    const examples: any[] = [];

    for (const w of words) {
        if (!w.definitions || Array.isArray(w.definitions)) continue;
        const defs = w.definitions as any;
        if (defs.general_cn) {
            if (defs.business_cn && defs.business_cn !== null) {
                hasBusinessCn++;
                if (examples.length < 15) examples.push(w);
            } else {
                nullBusinessCn++;
            }
        }
    }

    console.log('=== business_cn 分布统计 ===');
    console.log('有 business_cn:', hasBusinessCn);
    console.log('business_cn 为 null:', nullBusinessCn);
    console.log('占比:', ((hasBusinessCn / (hasBusinessCn + nullBusinessCn)) * 100).toFixed(1) + '%');

    console.log('\n=== 示例（有 business_cn 的词汇）===');
    examples.forEach(w => {
        console.log(w.word + ':', JSON.stringify(w.definitions, null, 2));
    });
}

main().finally(() => prisma.$disconnect());
