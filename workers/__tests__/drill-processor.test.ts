import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processDrillJob } from '../drill-processor';
import { db } from '@/lib/db';
import { generateWithFailover } from '../llm-failover';
import { inventory } from '@/lib/core/inventory';

// Mocks
vi.mock('@/lib/db', () => ({
    db: {
        vocab: {
            findMany: vi.fn(),
        },
        userProgress: {
            findMany: vi.fn(),
        },
        $queryRaw: vi.fn(), // Will be configured in tests
    }
}));

vi.mock('../llm-failover', () => ({
    generateWithFailover: vi.fn(),
}));

vi.mock('@/lib/inventory', () => ({
    inventory: {
        pushDrill: vi.fn(),
        getInventoryCounts: vi.fn(),
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })
    }
}));

describe('Drill Processor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock for $queryRaw to return empty array or basic words
        (db.$queryRaw as any).mockResolvedValue([{ word: 'context1' }, { word: 'context2' }]);
    });

    it('should use Safe Parse to recover truncated JSON', async () => {
        // Mock Candidates
        (db.vocab.findMany as any).mockResolvedValue([{
            id: 1,
            word: 'abandon',
            definition_cn: '放弃',
            word_family: {}
        }]);

        // Mock Truncated LLM Response (Valid items array but missing closing)
        // safeParse recover logic requires a complete item object
        const truncatedJson = `
        {
            "drills": [
                {
                    "meta": { "format": "chat", "target_word": "abandon" },
                    "segments": []
                },
                {
                    "meta": { "format": "email", "target_word": "abandon" },
                    "segments": []
                
        `; // The second item is incomplete, but first is complete. recoverTruncatedJson should save the first one. 

        // Wait, recoverTruncatedJson looks for "items": [ ? 
        // Let's check Schema. Schema expects { drills: [...] }. 
        // The safeParse implementation handles generic objects but recoverTruncatedJson specifically looks for "items": [.
        // Ah, BatchDrillOutputSchema expects { drills: [...] }. 
        // But safeParse handles generic arrays? Or does recoverTruncatedJson ONLY work for "items"?
        // Checking lib/ai/utils.ts (Step 247): 
        // line 45: const itemsMatch = content.match(/"items"\s*:\s*\[/);
        // It hardcodes "items". 
        // BatchDrillOutputSchema uses "drills".
        // This means safeParse WON'T work for "drills" truncation unless we change the prompt or the util.
        // BUT, the prompt returns { drills: ... } ? Or does it?
        // Let's check workers/drill-processor.ts Step 232. 
        // Result is BatchDrillOutputSchema = { drills: ... }
        // So recoverTruncatedJson WILL FAIL because it looks for "items".
        // I must FIX lib/ai/utils.ts to support generic array keys or just "drills".
        // OR in the test I assume the util is improved.
        // Let's assume I fix the util first. 

        // Actually, Step 247 shows recoverTruncatedJson is hardcoded for "items". 
        // This is a BUG in the util if valid schema uses "drills".
        // However, I'm verifying the PROCESSOR. 
        // I should probably fix the util to support "drills" as well.


        (generateWithFailover as any).mockResolvedValue({
            text: truncatedJson,
            provider: 'mock-llm'
        });

        const job = {
            name: 'generate-SYNTAX',
            data: {
                userId: 'user-1',
                mode: 'SYNTAX',
                correlationId: 'test-1',
                vocabIds: [1]
            }
        } as any;

        // Execute
        const result = await processDrillJob(job);

        // Assert
        expect(result.success).toBe(true);
        expect(inventory.pushDrill).toHaveBeenCalled(); // Should successfully push despite truncation
    });

    it('should perform Smart Fetch (Plan A) when ids are missing', async () => {
        // Mock DB: No due items, fetch new items
        (db.userProgress.findMany as any).mockResolvedValue([]); // No due items
        (db.vocab.findMany as any).mockResolvedValue([{
            id: 100,
            word: 'smart-fetch',
            definition_cn: '智能获取',
            word_family: {}
        }]); // Fetch new

        // Mock LLM Response (Valid)
        const validJson = JSON.stringify({
            drills: [{
                meta: { format: 'chat', target_word: 'smart-fetch' },
                segments: []
            }]
        });

        (generateWithFailover as any).mockResolvedValue({
            text: validJson,
            provider: 'mock-llm'
        });

        // Mock Inventory Check
        (inventory.getInventoryCounts as any).mockResolvedValue({});

        const job = {
            name: 'generate-SYNTAX',
            data: {
                userId: 'user-1',
                mode: 'SYNTAX',
                correlationId: 'test-2',
                // vocabIds MISSING intentionally
            }
        } as any;

        // Execute
        const result = await processDrillJob(job);

        // Assert
        expect(result.success).toBe(true);
        expect(db.userProgress.findMany).toHaveBeenCalled(); // Should check due items
        expect(db.vocab.findMany).toHaveBeenCalled(); // Should fetch new items
        expect(inventory.pushDrill).toHaveBeenCalledWith(
            'user-1', 'SYNTAX', 100, expect.anything()
        );
    });
    it('should fetch specific candidates when vocabIds provided (Plan C)', async () => {
        (db.vocab.findMany as any).mockResolvedValue([{
            id: 200,
            word: 'plan-c',
            definition_cn: '方案C',
            word_family: {}
        }]);

        (generateWithFailover as any).mockResolvedValue({
            text: JSON.stringify({
                drills: [{
                    meta: { format: 'chat', target_word: 'plan-c' },
                    segments: []
                }]
            }),
            provider: 'mock-llm'
        });

        // Mock Inventory Check
        (inventory.getInventoryCounts as any).mockResolvedValue({});

        const job = {
            name: 'replenish_batch',
            data: {
                userId: 'user-1',
                mode: 'SYNTAX',
                correlationId: 'test-3',
                vocabIds: [200]
            }
        } as any;

        const result = await processDrillJob(job);

        expect(result.success).toBe(true);
        expect(db.vocab.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: { in: [200] } } })
        );
    });

    it('should filter out candidates that already have inventory (Race Condition Fix)', async () => {
        // Mock Candidates (Candidate A and B)
        (db.userProgress.findMany as any).mockResolvedValue([
            { vocab: { id: 301, word: 'cached-word', definition_cn: '缓存词', word_family: {} } },
            { vocab: { id: 302, word: 'new-word', definition_cn: '新词', word_family: {} } }
        ]);

        // Mock Inventory Check: 301 has 5 items (Should be skipped), 302 has 0 (Should be kept)
        (inventory.getInventoryCounts as any).mockResolvedValue({
            301: 5,
            302: 0
        });

        // Mock LLM Response
        (generateWithFailover as any).mockResolvedValue({
            text: JSON.stringify({
                drills: [{
                    meta: { format: 'chat', target_word: 'new-word' },
                    segments: []
                }]
            }),
            provider: 'mock-llm'
        });

        const job = {
            name: 'generate-SYNTAX',
            data: {
                userId: 'user-race-test',
                mode: 'SYNTAX',
                correlationId: 'test-race',
                // vocabIds missing -> Generic Fetch
            }
        } as any;

        // Execute
        const result = await processDrillJob(job);

        // Assert
        expect(result.success).toBe(true);
        // Expect only 302 to be processed, 301 skipped
        expect(inventory.getInventoryCounts).toHaveBeenCalledWith(
            'user-race-test', 'SYNTAX', expect.arrayContaining([301, 302])
        );

        // Verify only 1 push happened (for 302)
        expect(inventory.pushDrill).toHaveBeenCalledTimes(1);
        expect(inventory.pushDrill).toHaveBeenCalledWith(
            'user-race-test', 'SYNTAX', 302, expect.anything()
        );
    });

    it('should handle total LLM failure gracefully (Job Failure)', async () => {
        // Mock DB to return some candidates
        (db.vocab.findMany as any).mockResolvedValue([{
            id: 999,
            word: 'failure',
            definition_cn: '失败',
            word_family: {}
        }]);

        // Mock LLM Failure
        (generateWithFailover as any).mockRejectedValue(new Error('All providers failed'));

        const job = {
            name: 'generate-SYNTAX',
            data: {
                userId: 'user-fail',
                mode: 'SYNTAX',
                correlationId: 'test-fail',
                vocabIds: [999]
            }
        } as any;

        // Execute: Should throw to let BullMQ handle retry
        await expect(processDrillJob(job)).rejects.toThrow('All providers failed');
    });
});
