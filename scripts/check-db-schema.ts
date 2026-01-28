/**
 * 检查数据库 Schema
 * 功能：查询 UserProgress 表的列信息
 */

import { db } from "../lib/db";

async function main() {
    try {
        const result = await db.$queryRaw<any[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'UserProgress'
      ORDER BY ordinal_position;
    `;

        console.log("UserProgress 表字段信息:");
        console.table(result);

        // 检查 masteryScore 是否存在
        const hasMasteryScore = result.some(col => col.column_name === 'masteryScore');
        console.log(`\nmasteryScore 字段存在: ${hasMasteryScore ? '✅' : '❌'}`);

    } catch (error) {
        console.error("查询失败:", error);
    } finally {
        await db.$disconnect();
    }
}

main();
