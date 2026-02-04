
/**
 * Restore Database from JSON Backup
 * 
 * 功能：
 *   从 backups/ 目录读取最新的 JSON 备份文件，并恢复到数据库。
 *   恢复前会清空目标表（User, Vocab, UserProgress）。
 *   恢复后会重置 Vocab 表的自增 ID 序列。
 * 
 * 使用方法：
 *   npx tsx scripts/db-restore.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 开始恢复数据...');

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        console.error('❌ 备份目录不存在');
        process.exit(1);
    }

    // 1. Find latest timestamp
    const files = fs.readdirSync(backupDir);
    const timestamps = files
        .map(f => {
            // Match pattern like: vocab-2026-02-03T14-37-47-857Z.json
            // Timestamp part: 2026-02-03T14-37-47-857Z
            const match = f.match(/-(\d{4}-\d{2}-\d{2}T[\w-]+)\.json$/);
            return match ? match[1] : null;
        })
        .filter(t => t !== null)
        .sort()
        .reverse();

    if (timestamps.length === 0) {
        console.error('❌ 未找到备份文件');
        process.exit(1);
    }

    const latestTimestamp = timestamps[0];
    console.log(`📅 使用最新备份: ${latestTimestamp}`);

    // Helper to read JSON
    const readBackup = (type: string) => {
        const filePath = path.join(backupDir, `${type}-${latestTimestamp}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return [];
    };

    const users = readBackup('user');
    const vocabs = readBackup('vocab');
    const progress = readBackup('progress');

    console.log(`📊 准备恢复: User(${users.length}), Vocab(${vocabs.length}), UserProgress(${progress.length})`);

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Clean existing data (Reverse order of dependencies)
            // UserProgress -> Vocab, User
            console.log('🧹 清空现有数据...');
            await tx.userProgress.deleteMany({});
            await tx.articleVocab.deleteMany({}); // ArticleVocab depends on Vocab
            await tx.smartContent.deleteMany({}); // SmartContent depends on Vocab
            await tx.article.deleteMany({}); // Article depends on User

            // Delete Users (Wait, seed created InvitationCode, Article, etc?)
            // We need to be careful with other tables.
            // UserProgress depends on User and Vocab.
            // Article depends on User.
            // DrillCache depends on User.

            await tx.drillCache.deleteMany({});
            await tx.user.deleteMany({}); // Deletes seeded user

            // Vocab
            await tx.vocab.deleteMany({});

            // 2. Insert Data
            console.log('📥 写入数据...');

            if (users.length > 0) {
                await tx.user.createMany({ data: users });
                console.log(`✅ User table restored (${users.length})`);
            }

            if (vocabs.length > 0) {
                // Remove id if we want autoincrement to re-generate? 
                // No, we want to KEEP the IDs to maintain relations.
                await tx.vocab.createMany({ data: vocabs });
                console.log(`✅ Vocab table restored (${vocabs.length})`);
            }

            if (progress.length > 0) {
                await tx.userProgress.createMany({ data: progress });
                console.log(`✅ UserProgress table restored (${progress.length})`);
            }

            // 3. Reset Sequences (Postgres specific)
            // For Vocab ID
            console.log('🔧 重置自增序列...');
            const maxIdResult = await tx.vocab.aggregate({
                _max: { id: true }
            });
            const maxId = maxIdResult._max.id || 0;
            // Use safe integer for setval
            await tx.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Vocab"', 'id'), ${maxId + 1}, false);`);
        }, {
            maxWait: 20000,
            timeout: 60000
        });

        console.log('\n🎉 数据恢复完成！');

    } catch (error) {
        console.error('❌ 恢复失败:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
