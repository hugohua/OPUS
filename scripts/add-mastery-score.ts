/**
 * 添加 masteryScore 字段到 UserProgress 表
 */

import { db } from "../lib/db";

async function main() {
    try {
        console.log("正在添加 masteryScore 字段...");

        await db.$executeRaw`
      ALTER TABLE "UserProgress" 
      ADD COLUMN IF NOT EXISTS "masteryScore" INTEGER NOT NULL DEFAULT 0;
    `;

        console.log("✅ 成功添加 masteryScore 字段");

        // 验证
        const result = await db.$queryRaw<any[]>`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'UserProgress' AND column_name = 'masteryScore';
    `;

        if (result.length > 0) {
            console.log("✅ 验证成功: masteryScore 字段已存在");
        } else {
            console.log("❌ 验证失败: masteryScore 字段不存在");
        }

    } catch (error) {
        console.error("操作失败:", error);
    } finally {
        await db.$disconnect();
    }
}

main();
