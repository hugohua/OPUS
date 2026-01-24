/**
 * reset-password.ts
 * 功能：重置指定用户的密码为 '123456'
 */
try { process.loadEnvFile(); } catch { }
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

const TARGET_EMAIL = '13964332@qq.com';
const NEW_PASSWORD = '123456';

async function main() {
    console.log(`准备重置用户 ${TARGET_EMAIL} 的密码...`);

    const user = await db.user.findUnique({
        where: { email: TARGET_EMAIL }
    });

    if (!user) {
        console.error('用户不存在！');
        return;
    }

    const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

    await db.user.update({
        where: { email: TARGET_EMAIL },
        data: { password: hashedPassword }
    });

    console.log(`✅ 密码已重置为: ${NEW_PASSWORD}`);
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
