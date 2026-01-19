/**
 * 词汇样本导出脚本
 *
 * 功能：
 *   从数据库导出 10 条词汇记录到 JSON 文件。
 *   用于快速检查数据库内容或生成测试用例。
 *
 * 使用方法：
 *   npx tsx scripts/export-vocab-sample.ts
 *
 * 输出文件：
 *   ./vocab_sample.json
 *
 * ⚠️ 注意：
 *   1. 需要正确配置 DATABASE_URL 环境变量
 *   2. 输出文件将覆盖同名文件
 */

import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('Fetching 10 vocab items...');
    const items = await prisma.vocab.findMany({
        take: 10,
    });

    const outputPath = path.join(process.cwd(), 'vocab_sample.json');
    fs.writeFileSync(outputPath, JSON.stringify(items, null, 2));

    console.log(`✅ Exported ${items.length} items to ${outputPath}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
