
/**
 * Restore Database from JSON
 * 
 * 功能：
 *   从 backups/ 目录读取最新的 JSON 文件并恢复到数据库。
 *   主要恢复 Vocab 表。
 * 
 * 使用方法：
 *   npx tsx scripts/db-restore.ts
 */

import { PrismaClient } from '../generated/prisma/client';
import fs from 'fs';
import path from 'path';

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    console.log('📦 开始恢复数据...');

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        console.error('❌ 没有找到 backups 目录');
        return;
    }

    // Find latest vocab backup
    const files = fs.readdirSync(backupDir);
    const vocabFile = files
        .filter(f => f.startsWith('vocab-') && f.endsWith('.json'))
        .sort()
        .pop();

    if (!vocabFile) {
        console.error('❌ 没有找到 Vocab 备份文件');
        return;
    }

    const filePath = path.join(backupDir, vocabFile);
    console.log(`📄 读取备份文件: ${vocabFile}`);

    try {
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const vocabs = JSON.parse(rawData);

        if (!Array.isArray(vocabs) || vocabs.length === 0) {
            console.log('⚠️ 备份文件为空或格式错误');
            return;
        }

        // Clean data for insertion
        const cleanVocabs = vocabs.map((v: any) => {
            // Remove embedding to avoid compatibility issues with Unsupported type
            const { embedding, ...rest } = v;

            // Ensure frequency_score exists (if backup is old)
            if (rest.frequency_score === undefined) {
                rest.frequency_score = 0;
            }

            // Remove id to allow Postgres to handle sequence properly?
            // No, we want to keep IDs to preserve relationships if any.
            // But we must update the sequence later if we insert IDs manually.
            // For now, let's keep IDs.
            return rest;
        });

        console.log(`🔄 正在恢复 ${cleanVocabs.length} 条 Vocab 记录...`);

        // Batch insert
        // Prisma createMany is efficient
        const batchSize = 1000;
        for (let i = 0; i < cleanVocabs.length; i += batchSize) {
            const batch = cleanVocabs.slice(i, i + batchSize);
            await prisma.vocab.createMany({
                data: batch,
                skipDuplicates: true // In case some data already exists
            });
            console.log(`   - 已插入 ${Math.min(i + batchSize, cleanVocabs.length)} / ${cleanVocabs.length}`);
        }

        // Update sequence (Critical for Postgres when inserting manual IDs)
        // We need to find the max ID and set the sequence
        const maxIdResult = await prisma.vocab.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true }
        });

        if (maxIdResult) {
            const resetSql = `SELECT setval(pg_get_serial_sequence('"Vocab"', 'id'), ${maxIdResult.id})`;
            await prisma.$queryRawUnsafe(resetSql);
            console.log(`🔢 序列已重置为: ${maxIdResult.id}`);
        }

        console.log('\n🎉 数据恢复完成！');

    } catch (error) {
        console.error('❌ 恢复失败:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
