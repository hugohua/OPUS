'use server';

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/db';

export async function cleanupAudioCacheAction() {
    try {
        console.log('🚀 开始扫描 TTS 缓存一致性... (Server Action)');

        const allCaches = await prisma.tTSCache.findMany({
            select: {
                id: true,
                url: true,
                filePath: true,
            },
        });

        let validCount = 0;
        let missingCount = 0;
        let deletedCount = 0;

        for (const cache of allCaches) {
            const relativePath = cache.filePath.startsWith('/')
                ? cache.filePath.slice(1)
                : cache.filePath;

            const absolutePath = path.join(process.cwd(), 'public', relativePath);
            const exists = fs.existsSync(absolutePath);

            if (exists) {
                validCount++;
            } else {
                missingCount++;
                try {
                    await prisma.tTSCache.delete({
                        where: { id: cache.id },
                    });
                    deletedCount++;
                } catch (err) {
                    console.error(`❌ 删除失败 ID=${cache.id}:`, err);
                }
            }
        }

        console.log('\n🔍 开始跨目录扫描物理文件... (Server Action)');
        let totalFilesCount = 0;
        let orphanDeletedCount = 0;

        const audioDir = path.join(process.cwd(), 'public', 'audio');

        function getFiles(dir: string): string[] {
            let results: string[] = [];
            if (!fs.existsSync(dir)) return results;

            const list = fs.readdirSync(dir);
            list.forEach((file) => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat && stat.isDirectory()) {
                    results = results.concat(getFiles(filePath));
                } else {
                    if (!file.endsWith('.DS_Store')) {
                        results.push(filePath);
                    }
                }
            });
            return results;
        }

        const localFiles = getFiles(audioDir);
        totalFilesCount = localFiles.length;

        const dbAbsolutePaths = new Set<string>();
        for (const cache of allCaches) {
            let relPath = cache.filePath.startsWith('/') ? cache.filePath.slice(1) : cache.filePath;
            dbAbsolutePaths.add(path.join(process.cwd(), 'public', relPath));
        }

        for (const localFile of localFiles) {
            if (!dbAbsolutePaths.has(localFile)) {
                try {
                    fs.unlinkSync(localFile);
                    orphanDeletedCount++;
                } catch (err) {
                    console.error(`❌ 删除实体文件失败: ${localFile}`, err);
                }
            }
        }

        return {
            success: true,
            data: {
                totalCaches: allCaches.length,
                validCount,
                missingCount,
                deletedCount,
                totalFilesCount,
                orphanDeletedCount
            }
        };

    } catch (error: any) {
        console.error('Audio Cache Cleanup Error:', error);
        return {
            success: false,
            error: error.message || '清理过程中发生未知错误'
        };
    }
}
