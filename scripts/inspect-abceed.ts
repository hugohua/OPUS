/**
 * Abceed 原始数据检查脚本
 *
 * 功能：
 *   解析并检查 abceed.json 原始数据文件的结构。
 *   输出根节点键名、数组长度及样本数据，便于理解数据格式。
 *
 * 使用方法：
 *   npx tsx scripts/inspect-abceed.ts
 *
 * ⚠️ 注意：
 *   1. 需要 raw_data/abceed.json 文件存在
 *   2. 仅用于数据探索，不会修改任何文件
 */

import fs from 'fs';

const raw = fs.readFileSync('raw_data/abceed.json', 'utf-8');
const data = JSON.parse(raw);

console.log('Root keys:', Object.keys(data));

// Check likely candidates for the list
const possibleLists = Object.keys(data).filter(k => Array.isArray(data[k]));
possibleLists.forEach(k => {
    console.log(`Array "${k}" length:`, data[k].length);
    if (data[k].length > 0) {
        console.log(`Sample item from "${k}":`, JSON.stringify(data[k][0], null, 2));
    }
});
