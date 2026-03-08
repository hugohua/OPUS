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

    // 4. 反向检查：找到并清理孤儿实体文件
    console.log('\n🔍 开始跨目录扫描物理文件...');
    let totalFilesCount = 0;
    let orphanDeletedCount = 0;

    const audioDir = path.join(process.cwd(), 'public', 'audio');

    // 递归获取目录下所有文件
    function getFiles(dir: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;

        const list = fs.readdirSync(dir);
        list.forEach((file) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFiles(filePath));
            } else {
                if (!file.endsWith('.DS_Store')) {
                    results.push(filePath);
                }
            }
        });
        return results;
    }

    const localFiles = getFiles(audioDir);
    totalFilesCount = localFiles.length;
    console.log(`📂 本地音频文件总数: ${totalFilesCount}`);

    // 构建数据库记录路径的 Set（使用绝对路径，方便匹配）
    const dbAbsolutePaths = new Set<string>();
    for (const cache of allCaches) {
        let relPath = cache.filePath.startsWith('/') ? cache.filePath.slice(1) : cache.filePath;
        // 有些数据库记录可能只带文件名或者带有额外的 audio/ 前缀
        // 这里需要将其统一为相对于 public/audio 的路径，但从刚才的查询逻辑来看
        // 它的 absolutePath 是 path.join(process.cwd(), 'public', relPath)
        dbAbsolutePaths.add(path.join(process.cwd(), 'public', relPath));
    }

    // 检查哪些本地文件不在数据库中记录里
    for (const localFile of localFiles) {
        if (!dbAbsolutePaths.has(localFile)) {
            console.warn(`🗑️ [孤儿文件] 被删除: ${localFile}`);
            try {
                fs.unlinkSync(localFile);
                orphanDeletedCount++;
            } catch (err) {
                console.error(`❌ 删除实体文件失败: ${localFile}`, err);
            }
        }
    }

    // 5. 输出报告
    console.log('\n✅ 扫描完成');
    console.log('-----------------------------------');
    console.log(`【数据库清理】`);
    console.log(`总记录数:   ${allCaches.length}`);
    console.log(`有效文件:   ${validCount}`);
    console.log(`丢失文件:   ${missingCount}`);
    console.log(`已删除无效记录: ${deletedCount}`);
    console.log('-----------------------------------');
    console.log(`【实体文件清理】`);
    console.log(`本地文件总数: ${totalFilesCount}`);
    console.log(`已删除孤儿文件: ${orphanDeletedCount}`);
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
