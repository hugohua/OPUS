/**
 * 脚本名称: refactor-lib-structure.ts
 * 功能:
 *   将 lib/ 根目录下的部分业务文件 (blitz.ts, inventory.ts, audio.ts) 移动到 lib/core/ 目录，
 *   并自动更新全项目中的引用路径。
 * 
 * 使用方法:
 *   npx tsx scripts/refactor-lib-structure.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 配置重构规则
const MOVES = [
    {
        file: 'lib/blitz.ts',
        target: 'lib/core/blitz.ts',
        fromImport: '@/lib/blitz',
        toImport: '@/lib/core/blitz'
    },
    {
        file: 'lib/inventory.ts',
        target: 'lib/core/inventory.ts',
        fromImport: '@/lib/inventory',
        toImport: '@/lib/core/inventory'
    },
    {
        file: 'lib/audio.ts',
        target: 'lib/core/audio.ts',
        fromImport: '@/lib/audio',
        toImport: '@/lib/core/audio'
    }
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    try {
        const files = fs.readdirSync(dirPath);

        files.forEach((file) => {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                if (!['node_modules', '.next', 'dist', '.git', '.agent', '.gemini', '.idea', '.vscode'].includes(file)) {
                    getAllFiles(fullPath, arrayOfFiles);
                }
            } else {
                if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                    arrayOfFiles.push(fullPath);
                }
            }
        });
    } catch (e) {
        console.warn(`Error reading directory ${dirPath}:`, e);
    }
    return arrayOfFiles;
}

async function main() {
    console.log('🚀 Starting Lib Refactor (ESM Fixed)...');

    // 1. 确保目标目录存在
    const coreDir = path.join(PROJECT_ROOT, 'lib', 'core');
    if (!fs.existsSync(coreDir)) {
        console.log(`📁 Creating directory: lib/core`);
        fs.mkdirSync(coreDir, { recursive: true });
    }

    // 2. 移动文件
    for (const move of MOVES) {
        const oldPath = path.join(PROJECT_ROOT, move.file);
        const newPath = path.join(PROJECT_ROOT, move.target);

        // 如果原文件还在，移动它
        // 如果原文件不在，但新文件在，说明可能已经移动过了，主要检查更新引用
        if (fs.existsSync(oldPath)) {
            console.log(`🚚 Moving ${move.file} -> ${move.target}`);
            fs.renameSync(oldPath, newPath);
        } else if (fs.existsSync(newPath)) {
            console.log(`ℹ️  File already moved to ${move.target}. Checking imports...`);
        } else {
            console.warn(`⚠️  File not found in source or dest: ${move.file}, skipping move.`);
        }
    }

    // 3. 扫描并更新引用
    console.log('🔍 Scanning for imports to update...');
    const files = getAllFiles(PROJECT_ROOT);

    let updateCount = 0;

    for (const filePath of files) {
        // Skip script itself if needed, or target files
        if (filePath === fileURLToPath(import.meta.url)) continue;

        let content = fs.readFileSync(filePath, 'utf-8');
        let hasChanges = false;

        for (const move of MOVES) {
            // Regex 匹配: from "@/lib/blitz" 或 from '@/lib/blitz'
            // 考虑 import { ... } from ... 和 import ... from ...
            // Also need to be careful not to replace '@/lib/blitz2' (suffix check)
            // Use word boundary or quote check

            const regex = new RegExp(`from ['"]${move.fromImport}['"]`, 'g');

            if (regex.test(content)) {
                // Determine relative path for log
                const relPath = path.relative(PROJECT_ROOT, filePath);
                console.log(`   📝 Updating ${relPath}: ${move.fromImport} -> ${move.toImport}`);
                content = content.replace(regex, `from '${move.toImport}'`);
                hasChanges = true;
                updateCount++;
            }
        }

        if (hasChanges) {
            fs.writeFileSync(filePath, content, 'utf-8');
        }
    }

    console.log(`\n✅ Refactor complete! Updated imports in ${updateCount} files.`);
}

main().catch(console.error);
