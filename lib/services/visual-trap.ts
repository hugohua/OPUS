import { db } from '@/lib/db';
import { levenshtein } from '@/lib/algorithm/levenshtein';
import { createLogger } from '@/lib/logger';

const log = createLogger('services:visual-trap');

// 简单内存缓存，生产环境建议使用 Redis Set
let VOCAB_CACHE: string[] = [];
let CACHE_TIMESTAMP = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 Hour

export class VisualTrapService {
    /**
     * 加载词汇表 (Lazy Load)
     */
    private static async loadVocab() {
        if (VOCAB_CACHE.length > 0 && Date.now() - CACHE_TIMESTAMP < CACHE_TTL) {
            return;
        }

        try {
            // Fetch top 5000 common words for traps
            const vocabs = await db.vocab.findMany({
                select: { word: true },
                orderBy: { frequency_score: 'desc' },
                take: 5000
            });
            VOCAB_CACHE = vocabs.map(v => v.word.toLowerCase());
            CACHE_TIMESTAMP = Date.now();
            log.info({ count: VOCAB_CACHE.length }, '已加载 Visual Trap 候选词库');
        } catch (error) {
            log.error({ error }, '加载词库失败');
        }
    }

    /**
     * 生成视觉干扰项
     * @param targetWord 目标词
     * @param count 数量
     * @returns 干扰词列表
     */
    static async generate(targetWord: string, count: number = 3): Promise<string[]> {
        await this.loadVocab();

        const lowerTarget = targetWord.toLowerCase();

        // 1. 计算所有词的编辑距离
        const candidates = VOCAB_CACHE
            .filter(w => w !== lowerTarget && Math.abs(w.length - lowerTarget.length) <= 2) // 长度差异优化
            .map(w => ({
                word: w,
                dist: levenshtein(lowerTarget, w)
            }))
            // 2. 筛选距离为 1 或 2 的词 (最像)
            .filter(c => c.dist >= 1 && c.dist <= 2);

        // 3. 排序 (越近越好) 并随机取
        // 为了增加随机性，取前 10 个然后 Shuffle
        const topCandidates = candidates
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 20);

        const shuffled = topCandidates.sort(() => Math.random() - 0.5);

        return shuffled.slice(0, count).map(c => c.word);
    }
}
