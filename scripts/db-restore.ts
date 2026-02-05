
/**
 * Restore Database from JSON Backup (No Transaction)
 * 
 * 功能：
 *   从 backups/ 目录读取最新的 JSON 备份文件，并恢复到数据库。
 *   直接执行，不使用事务 (用于排查事务崩溃问题)。
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
    console.log('🔄 开始全量恢复数据 (无事务版)...');

    await prisma.$connect();
    console.log('✅ 数据库连接成功');

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        console.error('❌ 备份目录不存在');
        process.exit(1);
    }

    // 1. Find latest timestamp
    const files = fs.readdirSync(backupDir);
    const timestamps = files
        .map(f => {
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
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const data = JSON.parse(content);
                console.log(`📖 [Read] ${type}: ${data.length} 条记录`);
                return data;
            } catch (e) {
                console.error(`❌ 读取 ${filePath} 失败:`, e);
                return [];
            }
        }
        console.log(`⚠️ 未找到 ${type} 备份，跳过`);
        return [];
    };

    try {
        // 1. DELETE PHASE
        console.log('\n🧹 阶段 1: 清空现有数据...');

        // Level 4
        await prisma.articleVocab.deleteMany({});
        console.log('  - Cleared ArticleVocab');
        await prisma.userProgress.deleteMany({});
        console.log('  - Cleared UserProgress');
        await prisma.smartContent.deleteMany({});
        console.log('  - Cleared SmartContent');
        await prisma.etymology.deleteMany({});
        console.log('  - Cleared Etymology');

        // Level 3
        await prisma.article.deleteMany({});
        console.log('  - Cleared Article');
        await prisma.drillCache.deleteMany({});
        console.log('  - Cleared DrillCache');

        // Level 2
        await prisma.user.deleteMany({});
        console.log('  - Cleared User');
        await prisma.vocab.deleteMany({});
        console.log('  - Cleared Vocab');
        await prisma.tTSCache.deleteMany({});
        console.log('  - Cleared TTSCache');
        await prisma.drillAudit.deleteMany({});
        console.log('  - Cleared DrillAudit');

        // Level 1
        await prisma.invitationCode.deleteMany({});
        console.log('  - Cleared InvitationCode');

        console.log('✅ 清空完成');

        // 2. INSERT PHASE (Sequential Read & Insert)
        console.log('\n📥 阶段 2: 写入数据...');

        // Helper to insert
        const insert = async (type: string, model: any, data: any[]) => {
            if (data && data.length > 0) {
                await model.createMany({ data });
                console.log(`✅ [Insert] ${type} (${data.length})`);
            }
        };

        // Independent / Roots
        // DrillAudit
        {
            const data = readBackup('drillAudit');
            await insert('DrillAudit', prisma.drillAudit, data);
        }

        // InvitationCode
        {
            const data = readBackup('invitationCode');
            await insert('InvitationCode', prisma.invitationCode, data);
        }

        // TTSCache
        {
            const data = readBackup('ttsCache');
            await insert('TTSCache', prisma.tTSCache, data);
        }

        // User
        {
            const data = readBackup('user');
            await insert('User', prisma.user, data);
        }

        // Vocab
        {
            const data = readBackup('vocab');
            await insert('Vocab', prisma.vocab, data);
        }

        // Etymology (Depends on Vocab)
        {
            const data = readBackup('etymology');
            await insert('Etymology', prisma.etymology, data);
        }

        // Article (Depends on User)
        {
            const data = readBackup('article');
            await insert('Article', prisma.article, data);
        }

        // ArticleVocab (Depends on Article, Vocab)
        {
            const data = readBackup('articleVocab');
            await insert('ArticleVocab', prisma.articleVocab, data);
        }

        // SmartContent (Depends on Vocab, TTSCache)
        {
            const data = readBackup('smartContent');
            await insert('SmartContent', prisma.smartContent, data);
        }

        // UserProgress (Depends on User, Vocab)
        {
            const data = readBackup('progress');
            await insert('UserProgress', prisma.userProgress, data);
        }

        // 3. SEQUENCE RESET
        console.log('\n🔧 阶段 3: 重置自增序列...');
        const maxIdResult = await prisma.vocab.aggregate({
            _max: { id: true }
        });
        const maxId = maxIdResult._max.id || 0;
        // Only reset if maxId > 0
        if (maxId > 0) {
            await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Vocab"', 'id'), ${maxId + 1}, false);`);
            console.log(`✅ Vocab sequence reset to ${maxId + 1}`);
        }

        console.log('\n🎉 数据全量恢复完成！');

    } catch (error) {
        console.error('❌ 恢复失败:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
