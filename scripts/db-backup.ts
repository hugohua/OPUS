
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

import { PrismaClient } from '@prisma/client';
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

        // 7. Backup SmartContent (High Value)
        const smartContent = await prisma.smartContent.findMany();
        const smartContentPath = path.join(backupDir, `smartContent-${timestamp}.json`);
        fs.writeFileSync(smartContentPath, JSON.stringify(smartContent, null, 2));
        console.log(`✅ [SmartContent] 已备份 ${smartContent.length} 条记录到 ${smartContentPath}`);

        // 8. Backup Etymology (High Value)
        const etymology = await prisma.etymology.findMany();
        const etymologyPath = path.join(backupDir, `etymology-${timestamp}.json`);
        fs.writeFileSync(etymologyPath, JSON.stringify(etymology, null, 2));
        console.log(`✅ [Etymology] 已备份 ${etymology.length} 条记录到 ${etymologyPath}`);

        // 9. Backup TTSCache (High Value Metadata)
        const ttsCache = await prisma.tTSCache.findMany();
        const ttsCachePath = path.join(backupDir, `ttsCache-${timestamp}.json`);
        fs.writeFileSync(ttsCachePath, JSON.stringify(ttsCache, null, 2));
        console.log(`✅ [TTSCache] 已备份 ${ttsCache.length} 条记录到 ${ttsCachePath}`);

        // 10. Backup DrillAudit (Analytics)
        const drillAudit = await prisma.drillAudit.findMany();
        const drillAuditPath = path.join(backupDir, `drillAudit-${timestamp}.json`);
        fs.writeFileSync(drillAuditPath, JSON.stringify(drillAudit, null, 2));
        console.log(`✅ [DrillAudit] 已备份 ${drillAudit.length} 条记录到 ${drillAuditPath}`);

        console.log('\n🎉 所有表备份完成！');

    } catch (error) {
        console.error('❌ 备份失败:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
