/**
 * 修复 TTS 缓存一致性脚本
 * 功能：
 *   扫描每一条 TTSCache 记录，检查对应的文件是否存在。
 *   如果文件不存在，则删除数据库记录，防止返回无效 URL。
 * 使用方法：
 *   npx tsx scripts/fix-tts-cache.ts
 * 注意：
 *   1. 生产环境建议在低峰期运行，避免大量 IO。
 *   2. 自动加载 .env 变量。
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

// 尝试加载环境变量
try {
    process.loadEnvFile();
} catch (e) {
    // 忽略，CI 或生产环境可能已注入
}

// 初始化 Prisma
const prisma = new PrismaClient();

async function main() {
    console.log('🚀 开始扫描 TTS 缓存一致性...');

    // 1. 获取所有缓存记录
    // 注意：如果数据量巨大 (百万级)，应使用 cursor 分页。
    // 当前为了简单起见，假设缓存量在几万条以内。
    const allCaches = await prisma.tTSCache.findMany({
        select: {
            id: true,
            url: true,
            filePath: true,
        },
    });

    console.log(`📊 数据库记录总数: ${allCaches.length}`);

    let validCount = 0;
    let missingCount = 0;
    let deletedCount = 0;

    // 2. 遍历检查
    for (const cache of allCaches) {
        // 构造绝对路径
        // 假设 filePath 存储的是相对路径，或者 url 映射到 public 目录
        // 常见的 filePath 格式可能是 "audio/xxx.wav" 或 "/audio/xxx.wav"
        // 需要适配不同的存储策略。这里假设存储在 public 目录下。

        // 移除开头的斜杠以进行路径拼接
        const relativePath = cache.filePath.startsWith('/')
            ? cache.filePath.slice(1)
            : cache.filePath;

        const absolutePath = path.join(process.cwd(), 'public', relativePath);

        const exists = fs.existsSync(absolutePath);

        if (exists) {
            validCount++;
        } else {
            missingCount++;
            console.warn(`⚠️ 文件丢失: ID=${cache.id}, Path=${absolutePath}`);

            // 3. 删除无效记录
            try {
                await prisma.tTSCache.delete({
                    where: { id: cache.id },
                });
                deletedCount++;
            } catch (err) {
                console.error(`❌ 删除失败 ID=${cache.id}:`, err);
            }
        }
    }

    // 4. 输出报告
    console.log('\n✅ 扫描完成');
    console.log('-----------------------------------');
    console.log(`总记录数:   ${allCaches.length}`);
    console.log(`有效文件:   ${validCount}`);
    console.log(`丢失文件:   ${missingCount}`);
    console.log(`已删除记录: ${deletedCount}`);
    console.log('-----------------------------------');
}

main()
    .catch((e) => {
        console.error('❌ 脚本执行错误:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
