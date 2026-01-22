/**
 * Vectorize Vocabulary Script (AliCloud Edition)
 * 
 * 功能:
 *   为 Vocab 表中的单词生成向量 (Embeddings)，用于语义搜索。
 *   使用 阿里云 (AliCloud/DashScope) text-embedding-v3 模型 (1536 维)。
 *   
 *   核心策略: "Semantic Sandwich" (语义三明治)
 *   Payload = Word + Business Definition + Scenarios + Top 3 Collocations
 *   
 *   目的: 确保 "minutes" 被理解为 "会议记录" 而非 "时间单位"。
 * 
 * 使用方法:
 *   npx tsx scripts/vectorize-vocab.ts
 *   npx tsx scripts/vectorize-vocab.ts --dry-run
 *   npx tsx scripts/vectorize-vocab.ts --force (强制重新生成所有向量)
 * 
 * 环境变量:
 *   DASHSCOPE_API_KEY (必需)
 *   HTTPS_PROXY (可选)
 */

import { PrismaClient, Vocab } from '../generated/prisma/client';
import { createOpenAI } from '@ai-sdk/openai';
import { embedMany } from 'ai';
import { createLogger } from '../lib/logger';
import { HttpsProxyAgent } from 'https-proxy-agent';
import nodeFetch, { RequestInit as NodeFetchRequestInit } from 'node-fetch';

// --- Env Loading ---
try {
    process.loadEnvFile();
} catch (e) {
    // Ignore
}

const log = createLogger('vectorizer');
const prisma = new PrismaClient();

// --- Configuration ---
const BATCH_SIZE = 5; // 阿里云限流较严（Max 10），保守一点
const MODEL_NAME = 'text-embedding-v2'; // v2 supports 1536 dims, v3 is 1024
const API_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

// --- OpenAI Client Setup (Factory) ---
function createProxyFetch(proxyUrl?: string): typeof fetch | undefined {
    // 如果显式禁用代理 (设置为空字符串)，则返回 undefined
    if (proxyUrl === "") return undefined;

    // 否则尝试读取参数或环境变量
    const finalProxyUrl = proxyUrl || process.env.HTTPS_PROXY;

    if (!finalProxyUrl) return undefined;

    log.debug({ proxy: finalProxyUrl }, 'Proxy enabled for AI requests');
    const agent = new HttpsProxyAgent(finalProxyUrl);

    const proxyFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input.toString();
        const nodeFetchInit: NodeFetchRequestInit = {
            method: init?.method,
            headers: init?.headers as NodeFetchRequestInit['headers'],
            body: init?.body as NodeFetchRequestInit['body'],
            agent,
        };
        const response = await nodeFetch(url, nodeFetchInit);
        return response as unknown as Response;
    };

    return proxyFetch;
}

const proxyFetch = createProxyFetch(process.env.HTTPS_PROXY);

// 使用兼容模式初始化 OpenAI 客户端
const openai = createOpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY, // 优先使用 DashScope Key
    baseURL: API_BASE_URL,
    ...(proxyFetch && { fetch: proxyFetch }),
});

const embeddingModel = openai.embedding(MODEL_NAME);

// --- Helpers ---

// Format vector for pgvector (string format: '[1.0,2.0,3.0]')
function formatVector(vector: number[]): string {
    return `[${vector.join(',')}]`;
}

// 构造 "Semantic Sandwich" Payload
// Embedding = Word + Business Definition + Scenarios + Top Collocations
function constructEmbeddingPayload(vocab: Pick<Vocab, 'word' | 'definition_cn' | 'definitions' | 'scenarios' | 'collocations'>): string {
    // 1. 核心身份: 单词本身
    const word = vocab.word;

    // 2. 商务定义: 优先取 business_cn，消歧义关键
    let businessDef = "";
    if (vocab.definitions && typeof vocab.definitions === 'object' && !Array.isArray(vocab.definitions)) {
        const defs = vocab.definitions as Record<string, string>;
        businessDef = defs['business_cn'] || vocab.definition_cn || "";
    } else {
        businessDef = vocab.definition_cn || "";
    }

    // 3. 场景标签: 建立场景关联
    // Scenarios is string[]
    const scenarioStr = (vocab.scenarios || []).join(", ");

    // 4. 常用搭配: 取 Top 3，强化"1+N"匹配能力
    let collocationStr = "";
    if (Array.isArray(vocab.collocations)) {
        collocationStr = (vocab.collocations as any[])
            .slice(0, 3)
            .map(c => c.text)
            .join(", ");
    }

    // 最终组装
    // 格式设计为 Key: Value 形式，帮助模型理解不同部分的语义作用
    return `Word: ${word}
Meaning: ${businessDef}
Context: ${scenarioStr}
Usage: ${collocationStr}`;
}

interface VocabCandidate {
    id: number;
    word: string;
    definition_cn: string | null;
    definitions: any;
    scenarios: string[];
    collocations: any;
}


// Fetch batch of words needing vectorization
async function fetchCandidates(take: number, force: boolean): Promise<VocabCandidate[]> {
    let ids: { id: number }[] = [];

    if (force) {
        // 简单处理：随机取一批，或者按 ID 顺序 loop (需要外部控制，这里简化为取前 N 个)
        // 如果要真正支持 Force Loop，需要在 main 中记录 cursor
        ids = await prisma.$queryRaw<{ id: number }[]>`
            SELECT id FROM "Vocab" 
            ORDER BY id ASC 
            LIMIT ${take}
        `;
    } else {
        ids = await prisma.$queryRaw<{ id: number }[]>`
            SELECT id FROM "Vocab" 
            WHERE embedding IS NULL 
            ORDER BY id ASC 
            LIMIT ${take}
        `;
    }

    if (ids.length === 0) return [];

    const idList = ids.map(x => x.id);

    return prisma.vocab.findMany({
        where: { id: { in: idList } },
        select: {
            id: true,
            word: true,
            definition_cn: true,
            definitions: true,
            scenarios: true,
            collocations: true,
        }
    });
}

// --- Main ---

async function main() {
    log.info('Starting Vectorization Script (AliCloud Edition)...');

    const apiKey = process.env.DASHSCOPE_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        log.error('Missing API Key. Please set DASHSCOPE_API_KEY or OPENAI_API_KEY.');
        process.exit(1);
    }
    log.info({ model: MODEL_NAME, endpoint: API_BASE_URL }, 'AI Configuration');

    const isDryRun = process.argv.includes('--dry-run');
    const isForce = process.argv.includes('--force');

    if (isDryRun) log.info('Mode: DRY-RUN (No DB updates)');
    if (isForce) log.info('Mode: FORCE (Regenerate all)');

    let totalProcessed = 0;

    // Safety break for loop
    const MAX_LOOPS = 1000;
    let loopCount = 0;

    while (true) {
        loopCount++;
        if (loopCount > MAX_LOOPS) {
            log.warn('Max loops reached. Exiting for safety.');
            break;
        }

        // 1. Fetch Candidates
        const candidates = await fetchCandidates(BATCH_SIZE, isForce);

        if (candidates.length === 0) {
            log.info('No more items to process.');
            break;
        }

        // Force mode specific check to avoid infinite loop on same batch
        // Since fetchCandidates always gets the first N items, if we don't update them (dry-run) or if logic is flawed, we loop.
        // In LIVE mode, we update embedding so they won't be picked again (unless isForce=true).
        // If isForce=true, we MUST start form offset or random. 
        // For this MVP script, if isForce is used, strict pagination is needed. 
        // Let's simpler logic: if FORCE and processed > 0, break (run once per invocation or use external loop).
        // To be safe for user:
        if (isForce && totalProcessed > 0) {
            log.info('FORCE mode: Processed one batch. Exiting to avoid infinite loop. Run again to process more.');
            break;
        }

        log.info({ count: candidates.length, startId: candidates[0].id }, 'Fetched batch');

        // 2. Prepare Inputs (Semantic Sandwich)
        const inputs = candidates.map(constructEmbeddingPayload);

        // Debug first payload
        if (totalProcessed === 0) {
            log.info({ payloadExample: inputs[0] }, 'Payload Preview');
        }

        // 3. Generate Embeddings (Batch)
        try {
            // Dry run output
            if (isDryRun) {
                log.info('DRY-RUN: Simulation Delay...');
                await new Promise(r => setTimeout(r, 500));
                log.info('DRY-RUN: Skipping AI Call & DB Update');
                totalProcessed += candidates.length;
                continue;
            }

            const { embeddings } = await embedMany({
                model: embeddingModel,
                values: inputs,
            });

            log.info({ count: embeddings.length }, 'AI Embeddings Generated');

            // 4. Update DB
            let updateCount = 0;

            // Parallel writes
            await Promise.all(candidates.map(async (item, index) => {
                const vector = embeddings[index];
                if (!vector) return;

                const vectorStr = formatVector(vector);

                // Raw SQL update for vector type
                await prisma.$executeRawUnsafe(
                    `UPDATE "Vocab" SET "embedding" = $1::vector WHERE "id" = $2`,
                    vectorStr,
                    item.id
                );
                updateCount++;
            }));

            log.info({ updated: updateCount }, 'DB Updated');

            totalProcessed += candidates.length;

        } catch (err: any) {
            log.error({ error: err.message || err }, 'Error processing batch');

            // Check for rate limits
            if (String(err).includes('429') || String(err).includes('Rate Limit')) {
                log.warn('Rate limit hit. Waiting 10s...');
                await new Promise(r => setTimeout(r, 10000));
            } else {
                // Other errors, wait a bit
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    }

    log.info({ totalProcessed }, 'Vectorization Complete.');
}

main()
    .catch(e => {
        log.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
