import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';

// --- Mocks ---
vi.mock('@/lib/db', async () => {
    const { mockDeep } = await import('vitest-mock-extended');
    const mock = mockDeep<PrismaClient>();
    return { prisma: mock, db: mock };
});
vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({
    auth: vi.fn(),
}));

import { auth } from '@/auth';
import { getUserWeaknesses, getRadarData } from '../diagnostic-engine';

const mockPrisma = prisma as unknown as DeepMockProxy<PrismaClient>;
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

describe('getUserWeaknesses', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    });

    it('未认证且无 userId 时应返回空数组', async () => {
        mockAuth.mockResolvedValue(null);
        const result = await getUserWeaknesses();
        expect(result).toEqual([]);
    });

    it('无答题记录时应返回空数组', async () => {
        (mockPrisma.attemptRecord.findMany as any).mockResolvedValue([]);
        const result = await getUserWeaknesses('user-1');
        expect(result).toEqual([]);
    });

    it('应按 questionType 正确聚合正确率', async () => {
        (mockPrisma.attemptRecord.findMany as any).mockResolvedValue([
            { questionType: 'COLLOCATION', isCorrect: true, responseTimeMs: 2000 },
            { questionType: 'COLLOCATION', isCorrect: false, responseTimeMs: 5000 },
            { questionType: 'COLLOCATION', isCorrect: true, responseTimeMs: 3000 },
            { questionType: 'GRAMMAR', isCorrect: false, responseTimeMs: 4000 },
            { questionType: 'GRAMMAR', isCorrect: false, responseTimeMs: 6000 },
        ]);

        const result = await getUserWeaknesses('user-1');

        // GRAMMAR 正确率 0%，应排在第一位（最弱）
        expect(result[0].questionType).toBe('GRAMMAR');
        expect(result[0].accuracy).toBe(0);
        expect(result[0].total).toBe(2);
        expect(result[0].avgResponseMs).toBe(5000); // (4000+6000)/2

        // COLLOCATION 正确率 67%
        expect(result[1].questionType).toBe('COLLOCATION');
        expect(result[1].accuracy).toBe(67);
        expect(result[1].total).toBe(3);
    });

    it('应返回中文标签', async () => {
        (mockPrisma.attemptRecord.findMany as any).mockResolvedValue([
            { questionType: 'MORPHOLOGY', isCorrect: true, responseTimeMs: 1000 },
        ]);

        const result = await getUserWeaknesses('user-1');
        expect(result[0].label).toBe('词形变换');
    });

    it('未知题型应回退使用枚举值作为标签', async () => {
        (mockPrisma.attemptRecord.findMany as any).mockResolvedValue([
            { questionType: 'UNKNOWN_NEW_TYPE', isCorrect: true, responseTimeMs: 1000 },
        ]);

        const result = await getUserWeaknesses('user-1');
        expect(result[0].label).toBe('UNKNOWN_NEW_TYPE');
    });
});

describe('getRadarData', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
        vi.clearAllMocks();
        mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    });

    it('无数据时应返回空 radarData 和 null weakest', async () => {
        (mockPrisma.attemptRecord.findMany as any).mockResolvedValue([]);
        const result = await getRadarData('user-1');
        expect(result.radarData).toEqual([]);
        expect(result.weakest).toBeNull();
        expect(result.totalAttempts).toBe(0);
    });

    it('应将 weakest 设为正确率最低的那项', async () => {
        (mockPrisma.attemptRecord.findMany as any).mockResolvedValue([
            { questionType: 'COLLOCATION', isCorrect: true, responseTimeMs: 2000 },
            { questionType: 'COLLOCATION', isCorrect: true, responseTimeMs: 2000 },
            { questionType: 'GRAMMAR', isCorrect: false, responseTimeMs: 4000 },
        ]);

        const result = await getRadarData('user-1');
        expect(result.weakest?.questionType).toBe('GRAMMAR');
        expect(result.weakest?.accuracy).toBe(0);
        expect(result.totalAttempts).toBe(3);
    });

    it('radarData 应包含 subject/A/fullMark 格式', async () => {
        (mockPrisma.attemptRecord.findMany as any).mockResolvedValue([
            { questionType: 'SYNONYM', isCorrect: true, responseTimeMs: 1000 },
        ]);

        const result = await getRadarData('user-1');
        expect(result.radarData[0]).toEqual({
            subject: '近义辨析',
            A: 100,
            fullMark: 100,
        });
    });
});
