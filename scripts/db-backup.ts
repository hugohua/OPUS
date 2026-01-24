
/**
 * Backup Database to JSON
 * 
 * 功能：
 *   将 Vocab 和 UserProgress 表的数据导出为 JSON 文件。
 *   文件保存在 backups/ 目录下，文件名包含时间戳。
 * 
 * 使用方法：
 *   npx tsx scripts/db-backup.ts
 */

import { PrismaClient } from '../generated/prisma/client';
import fs from 'fs';
import path from 'path';

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

async function main() {
    console.log('📦 开始备份数据...');

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
        // 1. Backup Vocab
        const vocabs = await prisma.vocab.findMany();
        const vocabPath = path.join(backupDir, `vocab-${timestamp}.json`);
        fs.writeFileSync(vocabPath, JSON.stringify(vocabs, null, 2));
        console.log(`✅ [Vocab] 已备份 ${vocabs.length} 条记录到 ${vocabPath}`);

        // 2. Backup UserProgress
        const progress = await prisma.userProgress.findMany();
        const progressPath = path.join(backupDir, `progress-${timestamp}.json`);
        fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
        console.log(`✅ [UserProgress] 已备份 ${progress.length} 条记录到 ${progressPath}`);

        // 3. Backup User
        const users = await prisma.user.findMany();
        const userPath = path.join(backupDir, `user-${timestamp}.json`);
        fs.writeFileSync(userPath, JSON.stringify(users, null, 2));
        console.log(`✅ [User] 已备份 ${users.length} 条记录到 ${userPath}`);

        // 4. Backup Article
        const articles = await prisma.article.findMany();
        const articlePath = path.join(backupDir, `article-${timestamp}.json`);
        fs.writeFileSync(articlePath, JSON.stringify(articles, null, 2));
        console.log(`✅ [Article] 已备份 ${articles.length} 条记录到 ${articlePath}`);

        // // 5. Backup ArticleVocab
        const articleVocabs = await prisma.articleVocab.findMany();
        const articleVocabPath = path.join(backupDir, `articleVocab-${timestamp}.json`);
        fs.writeFileSync(articleVocabPath, JSON.stringify(articleVocabs, null, 2));
        console.log(`✅ [ArticleVocab] 已备份 ${articleVocabs.length} 条记录到 ${articleVocabPath}`);

        // 6. Backup InvitationCode
        const invitationCodes = await prisma.invitationCode.findMany();
        const invitationCodePath = path.join(backupDir, `invitationCode-${timestamp}.json`);
        fs.writeFileSync(invitationCodePath, JSON.stringify(invitationCodes, null, 2));
        console.log(`✅ [InvitationCode] 已备份 ${invitationCodes.length} 条记录到 ${invitationCodePath}`);

        console.log('\n🎉 所有表备份完成！');

    } catch (error) {
        console.error('❌ 备份失败:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
