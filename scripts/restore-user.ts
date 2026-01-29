/**
 * 脚本: 恢复用户账号
 * 功能: 
 *   根据日志中的 Session ID 重建用户记录，修复 P2003 外键错误。
 *   同时设置 Email 为用户指定的 13964332@qq.com。
 * 
 * 使用: npx tsx scripts/restore-user.ts
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@/lib/logger';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const log = createLogger('scripts:restore-user');

async function main() {
    const targetId = 'cmkqc2y5f0001umakqjgq1856'; // 来自 22920 终端日志
    const targetEmail = '13964332@qq.com';       // 用户指定

    console.log(`🔧 正在恢复用户...`);
    console.log(`   ID:    ${targetId}`);
    console.log(`   Email: ${targetEmail}`);

    console.log(`   Email: ${targetEmail}`);

    const hashedPassword = await bcrypt.hash("123456", 10);

    try {
        const user = await prisma.user.upsert({
            where: { id: targetId },
            update: {
                email: targetEmail,
                password: hashedPassword,
                name: 'Hugo'
            },
            create: {
                id: targetId,
                email: targetEmail,
                name: 'Hugo',
                password: hashedPassword,
                timezone: 'Asia/Shanghai',
                settings: { autoPlay: true }
            }
        });

        console.log(`\n✅ 用户恢复成功！`);
        console.log(`   User: ${user.name} (${user.email})`);
        console.log(`   现在您可以刷新页面或继续答题，P2003 错误应已消失。`);
        console.log(`   新密码已设置为: 123456 (请尝试登录)`);

    } catch (e: any) {
        // 如果 Email 已存在但 ID 不同，则删除旧账号（Force Restore）
        if (e.code === 'P2002') {
            console.log('\n⚠️ 检测到 Email 冲突，正在执行强制恢复...');
            const conflict = await prisma.user.findUnique({ where: { email: targetEmail } });
            if (conflict) {
                console.log(`   删除旧账号: ${conflict.id}`);
                await prisma.userProgress.deleteMany({ where: { userId: conflict.id } });
                await prisma.drillCache.deleteMany({ where: { userId: conflict.id } });
                await prisma.article.deleteMany({ where: { userId: conflict.id } });
                await prisma.user.delete({ where: { id: conflict.id } });
            }

            // 重试创建
            const user = await prisma.user.create({
                data: {
                    id: targetId,
                    email: targetEmail,
                    name: 'Restored User',
                    password: hashedPassword,
                    timezone: 'Asia/Shanghai',
                    settings: { autoPlay: true }
                }
            });
            console.log(`\n✅ 用户恢复成功 (强制覆盖)！`);
            console.log(`   User: ${user.name} (${user.email})`);
            console.log(`   现在您可以刷新页面或继续答题，P2003 错误应已消失。`);
            return;
        }
        console.error('\n❌ 恢复失败:', e);
    }
}

main().finally(() => prisma.$disconnect());
