/**
 * 导出向量化数据脚本 (Batch Export Script)
 * 
 * 功能：
 *   将未向量化的单词导出为文件，以便人工在阿里云控制台进行批处理或使用 Python 脚本跑批。
 *   支持格式：
 *   1. JSONL (推荐): 包含 id 和 payload，方便回填。
 *   2. TXT: 仅包含 payload 文本，用于简单的 Playground 测试。
 * 
 * 使用方法：
 *   npx tsx scripts/data-export-for-embedding.ts
 * 
 * 输出：
 *   output/batch_embedding_input.jsonl
 *   output/batch_embedding_input.txt
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '../lib/logger';
import { VectorizationService } from '../lib/ai/vectorization';
import fs from 'fs';
import path from 'path';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

const log = createLogger('exporter');
const prisma = new PrismaClient();
const service = new VectorizationService();

// 获取所有未向量化的单词
async function fetchAllCandidates() {
    // 获取 ID 列表
    const ids = await prisma.$queryRaw<{ id: number }[]>`
        SELECT id FROM "Vocab" 
        WHERE embedding IS NULL 
        ORDER BY id ASC 
    `;

    if (ids.length === 0) return [];

    const idList = ids.map(x => x.id);

    // 批量获取详情 (Prisma `in` 查询有参数限制，建议分批，这里假设数量级在万以内直接查)
    // 如果数据量巨大 > 30k，建议改为 cursor 分页。为脚本简单起见，这里暂不分批 (Postgres 参数上限约 65535)
    return prisma.vocab.findMany({
        where: { id: { in: idList } },
        select: {
            id: true,
            word: true,
            definition_cn: true,
            definitions: true,
            scenarios: true,
            collocations: true,
            synonyms: true
        }
    });
}

async function main() {
    log.info('Starting Batch Export Script...');

    const candidates = await fetchAllCandidates();
    log.info({ count: candidates.length }, 'Found candidates needing vectorization');

    if (candidates.length === 0) {
        log.info('No candidates found. Exiting.');
        return;
    }

    const outputDir = path.join(process.cwd(), 'output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonlPath = path.join(outputDir, 'batch_embedding_input.jsonl');
    const txtPath = path.join(outputDir, 'batch_embedding_input.txt');

    const jsonlStream = fs.createWriteStream(jsonlPath, { encoding: 'utf-8' });
    const txtStream = fs.createWriteStream(txtPath, { encoding: 'utf-8' });

    let count = 0;

    for (const vocab of candidates) {
        const payload = service.constructEmbeddingPayload(vocab);

        // 1. JSONL Format: OpenAI Batch API Standard
        // 参考: https://help.aliyun.com/zh/dashscope/developer-reference/batch-inference-quick-start
        const jsonLine = JSON.stringify({
            custom_id: String(vocab.id),
            method: "POST",
            url: "/v1/embeddings",
            body: {
                model: "text-embedding-v4",
                input: payload,
                encoding_format: "float",
                dimensions: 1536
            }
        });
        jsonlStream.write(jsonLine + '\n');

        // 2. TXT Format: Just the text, one per line (注意去除换行符，虽然 payload 中已经是单行)
        // 确保 payload 没有换行符
        const cleanPayload = payload.replace(/\n/g, ' ');
        txtStream.write(cleanPayload + '\n');

        count++;
        if (count % 100 === 0) {
            process.stdout.write(`\rExported ${count}/${candidates.length}`);
        }
    }

    jsonlStream.end();
    txtStream.end();

    console.log('\n'); // Newline
    log.info({ jsonl: jsonlPath, txt: txtPath }, 'Export Complete');
}

main()
    .catch(e => {
        log.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
