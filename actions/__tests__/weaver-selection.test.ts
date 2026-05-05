
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWeaverIngredients } from '../weaver-selection';
import { redis } from '@/lib/queue/connection';
import { prisma } from '@/lib/db';
import { auditWeaverSelection } from '@/lib/services/audit-service';
import { auth } from '@/auth';

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
        },
        vocab: {
            findMany: vi.fn()
        }
    }
}));

vi.mock('@/lib/services/audit-service', () => ({
    auditWeaverSelection: vi.fn()
}));

vi.mock('@/auth', () => ({
    auth: vi.fn()
}));

vi.mock('server-only', () => ({}));

describe('Weaver Selection Action', () => {
    const userId = "user-123";
    const scenario = "finance_group";

    beforeEach(() => {
        vi.clearAllMocks();
        (auth as any).mockResolvedValue({ user: { id: userId } });
    });

    it('should return cached data if available', async () => {
        const cachedData = {
            priorityWords: [{ id: 1, word: "asset", meaning: "资产" }],
            fillerWords: [{ id: 2, word: "is", meaning: "是" }]
        };
        (redis.get as any).mockResolvedValue(JSON.stringify(cachedData));

        const result = await getWeaverIngredients(userId, scenario, false, userId);

        expect(redis.get).toHaveBeenCalledWith(expect.stringContaining(`weaver:ingredients:${userId}:${scenario}:`));
        expect(result.status).toBe('success');
        expect(result.data).toEqual(cachedData);
        expect(auditWeaverSelection).not.toHaveBeenCalled();
    });

    it('should fetch ingredients, cache them, and audit if cache miss', async () => {
        (redis.get as any).mockResolvedValue(null);

        (prisma.userProgress.findMany as any)
            .mockResolvedValueOnce([
                { vocab: { id: 10, word: "equity", definition_cn: "权益" } }
            ])
            .mockResolvedValueOnce([
                { vocab: { id: 30, word: "invoice", definition_cn: "发票" } }
            ])
            .mockResolvedValueOnce([
                { vocab: { id: 20, word: "the", definition_cn: "这" } }
            ]);

        (prisma.vocab.findMany as any).mockResolvedValue([
            { id: 11, word: "asset", definition_cn: "资产" }
        ]);

        const result = await getWeaverIngredients(userId, scenario, false, userId);

        expect(prisma.userProgress.findMany).toHaveBeenCalled();
        expect(prisma.vocab.findMany).toHaveBeenCalled();
        expect(redis.setex).toHaveBeenCalledWith(
            expect.stringContaining(`weaver:ingredients:${userId}:${scenario}:`),
            30,
            expect.any(String)
        );

        expect(auditWeaverSelection).toHaveBeenCalledWith(userId, scenario, {
            priorityCount: 3,
            fillerCount: 1,
            priorityIds: [10, 11, 30],
            fillerIds: [20]
        });

        expect(result.status).toBe('success');
        expect(result.data?.priorityWords).toHaveLength(3);
    });

    it('should handle Zod validation errors', async () => {
        const result = await getWeaverIngredients(userId, "invalid-scenario" as any, false, userId);
        expect(result.status).toBe('error');
        // Need to check message or fieldErrors
        expect(result.message).toBe('Invalid parameters');
    });
});
