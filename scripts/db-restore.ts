
/**
 * Restore Database from JSON
 * 
 * 功能：
 *   从 backups/ 目录读取最新的 JSON 文件并恢复到数据库。
 *   支持 Vocab, User, UserProgress, Article, ArticleVocab, InvitationCode 表。
 * 
 * 使用方法：
 *   npx tsx scripts/db-restore.ts
 */

import { PrismaClient } from '../generated/prisma/client';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Load env
try { process.loadEnvFile(); } catch { }

const prisma = new PrismaClient();

const MOCK_USER_EMAIL = '13964332@qq.com';

async function main() {
    console.log('📦 开始恢复数据...');

    // Ensure mock user exists first
    console.log('👤 确保 Mock 用户存在...');
    let adminUser = await prisma.user.findUnique({ where: { email: MOCK_USER_EMAIL } });
    if (!adminUser) {
        console.log('   - 未找到 Mock 用户，准备直接创建...');
        adminUser = await prisma.user.create({
            data: {
                email: MOCK_USER_EMAIL,
                name: 'Hugo',
                password: '$2b$10$YourDefaultBcryptHashHere', // bcrypt hash for '13964332' or default
                invitedByCode: 'OPUS_GENESIS_KEY'
            }
        });
        console.log(`✅ 已创建 Mock 用户 ID: ${adminUser.id}`);
    } else {
        console.log(`✅ 已确认 Admin 用户 ID: ${adminUser.id}`);
    }

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        console.error('❌ 没有找到 backups 目录');
        return;
    }

    const files = fs.readdirSync(backupDir);
    const getLatestFile = (prefix: string) => {
        return files
            .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
            .sort()
            .pop();
    };

    const tables = [
        { name: 'Vocab', prefix: 'vocab-', prisma: (prisma as any).vocab },
        { name: 'User', prefix: 'user-', prisma: (prisma as any).user },
        { name: 'UserProgress', prefix: 'progress-', prisma: (prisma as any).userProgress },
        { name: 'Article', prefix: 'article-', prisma: (prisma as any).article },
        { name: 'ArticleVocab', prefix: 'articleVocab-', prisma: (prisma as any).articleVocab },
        { name: 'InvitationCode', prefix: 'invitationCode-', prisma: (prisma as any).invitationCode },
    ];

    try {
        for (const table of tables) {
            const latestFile = getLatestFile(table.prefix);
            if (!latestFile) {
                console.log(`⚠️ 跳过 ${table.name}: 找不到以 ${table.prefix} 开头的备份文件`);
                continue;
            }

            const filePath = path.join(backupDir, latestFile);
            console.log(`\n🔄 正在处理表: ${table.name} (文件: ${latestFile})...`);
            const rawData = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(rawData);

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`   - 备份数据为空，跳过。`);
                continue;
            }

            // Clean & Fix data for main branch compatibility
            const cleanData = data.map((item: any) => {
                const { embedding, ...rest } = item;

                // Field Fixes for branch compatibility
                if (table.name === 'User') {
                    if (!rest.password) rest.password = '$2b$10$YourDefaultBcryptHashHere'; // Should be a valid hash
                    if (!rest.updatedAt) rest.updatedAt = new Date();
                    if (!rest.timezone) rest.timezone = 'Asia/Shanghai';
                }

                if (table.name === 'Vocab') {
                    if (rest.frequency_score === undefined) rest.frequency_score = 0;
                    if (rest.learningPriority === undefined) rest.learningPriority = 0;
                }

                if (table.name === 'UserProgress') {
                    // FSRS v5 compatibility - Remove old fields
                    delete (rest as any).easeFactor;

                    // Fix Foreign Key - Map old userId to current adminUser.id
                    rest.userId = (adminUser as any).id;

                    if (rest.stability === undefined) rest.stability = 0;
                    if (rest.difficulty === undefined) rest.difficulty = 0;
                    if (rest.reps === undefined) rest.reps = 0;
                    if (rest.lapses === undefined) rest.lapses = 0;
                    if (rest.state === undefined) rest.state = 0;
                }

                return rest;
            });

            console.log(`   - 正在清空表...`);
            await table.prisma.deleteMany({});

            console.log(`   - 正在插入 ${cleanData.length} 条记录...`);
            const batchSize = 500;
            for (let i = 0; i < cleanData.length; i += batchSize) {
                const batch = cleanData.slice(i, i + batchSize);
                await table.prisma.createMany({
                    data: batch,
                    skipDuplicates: true
                });
            }

            // Sync sequence for ID (only for tables with BigInt/Int autoincrement PK)
            if (table.name === 'Vocab') {
                const maxIdResult = await prisma.vocab.findFirst({
                    orderBy: { id: 'desc' },
                    select: { id: true }
                });
                if (maxIdResult) {
                    await prisma.$queryRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Vocab"', 'id'), ${maxIdResult.id})`);
                }
            }

            console.log(`✅ ${table.name} 恢复完成`);
        }

        console.log('\n🎉 所有表数据恢复成功！');

    } catch (error) {
        console.error('❌ 恢复失败:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
