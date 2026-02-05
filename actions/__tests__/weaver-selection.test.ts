
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWeaverIngredients } from '../weaver-selection';
import { redis } from '@/lib/queue/connection';
import { prisma } from '@/lib/db';
import { auditWeaverSelection } from '@/lib/services/audit-service';

// Mocks
vi.mock('@/lib/queue/connection', () => ({
    redis: {
        get: vi.fn(),
        setex: vi.fn()
    }
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        userProgress: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('@/lib/services/omps-core', () => ({
    fetchOMPSCandidates: vi.fn()
}));

vi.mock('@/lib/services/audit-service', () => ({
    auditWeaverSelection: vi.fn()
}));

import { fetchOMPSCandidates } from '@/lib/services/omps-core';

describe('Weaver Selection Action', () => {
    const userId = "user-123";
    const scenario = "finance";

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return cached data if available', async () => {
        const cachedData = {
            priorityWords: [{ id: 1, word: "asset", meaning: "资产" }],
            fillerWords: [{ id: 2, word: "is", meaning: "是" }]
        };
        (redis.get as any).mockResolvedValue(JSON.stringify(cachedData));

        const result = await getWeaverIngredients(userId, scenario);

        expect(redis.get).toHaveBeenCalledWith(`weaver:ingredients:${userId}:${scenario}`);
        expect(result.status).toBe('success');
        expect(result.data).toEqual(cachedData);
        // Should NOT call OMPS or Audit if cached (assuming logic doesn't audit on cache hit?)
        // The implementation ONLY calls audit after fetching new ingredients before saving to cache.
        // So audit should NOT be called.
        expect(auditWeaverSelection).not.toHaveBeenCalled();
    });

    it('should fetch ingredients, cache them, and audit if cache miss', async () => {
        (redis.get as any).mockResolvedValue(null);

        // Mock PO/OMPS
        (fetchOMPSCandidates as any).mockResolvedValue([
            { vocabId: 10, word: "equity", definition_cn: "权益" }
        ]);

        // Mock Filler (Prisma)
        (prisma.userProgress.findMany as any).mockResolvedValue([
            { vocab: { id: 20, word: "the", definition_cn: "这" } }
        ]);

        const result = await getWeaverIngredients(userId, scenario);

        // Assertions
        expect(fetchOMPSCandidates).toHaveBeenCalledWith(userId, 10, expect.any(Object), [], "CONTEXT");
        expect(prisma.userProgress.findMany).toHaveBeenCalled();
        expect(redis.setex).toHaveBeenCalledWith(
            `weaver:ingredients:${userId}:${scenario}`,
            600,
            expect.any(String)
        );

        // Audit check
        expect(auditWeaverSelection).toHaveBeenCalledWith(userId, scenario, {
            priorityCount: 1,
            fillerCount: 1,
            priorityIds: [10],
            fillerIds: [20]
        });

        expect(result.status).toBe('success');
        expect(result.data?.priorityWords).toHaveLength(1);
    });

    it('should handle Zod validation errors', async () => {
        const result = await getWeaverIngredients("", "invalid-scenario" as any);
        expect(result.status).toBe('error');
        // Need to check message or fieldErrors
        expect(result.message).toBe('Invalid parameters');
    });
});
