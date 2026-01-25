import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findCachedDrill, markDrillConsumed, saveDrillToCache, checkCacheStatus } from '../drill-cache';
import { db } from '@/lib/db';

// Mock prisma
vi.mock('@/lib/db', () => ({
    db: {
        drillCache: {
            findFirst: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
            count: vi.fn(),
        }
    }
}));

describe('drill-cache', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('findCachedDrill', () => {
        it('should find first unconsumed valid cache', async () => {
            await findCachedDrill('user1', 'SYNTAX');
            expect(db.drillCache.findFirst).toHaveBeenCalledWith({
                where: {
                    userId: 'user1',
                    mode: 'SYNTAX',
                    isConsumed: false,
                    expiresAt: { gt: expect.any(Date) },
                },
                orderBy: { createdAt: 'asc' },
            });
        });
    });

    describe('markDrillConsumed', () => {
        it('should update isConsumed to true', async () => {
            await markDrillConsumed('cache-id-1');
            expect(db.drillCache.update).toHaveBeenCalledWith({
                where: { id: 'cache-id-1' },
                data: { isConsumed: true },
            });
        });
    });

    describe('saveDrillToCache', () => {
        it('should create new cache entry with expiry', async () => {
            const payload = [{ type: 'text', content_markdown: 'test' }] as any;
            await saveDrillToCache('user1', 'SYNTAX', payload);

            expect(db.drillCache.create).toHaveBeenCalledWith({
                data: {
                    userId: 'user1',
                    mode: 'SYNTAX',
                    payload: payload,
                    expiresAt: expect.any(Date), // Validation of addDays logic implicitly
                    isConsumed: false,
                }
            });
        });
    });

    describe('checkCacheStatus', () => {
        it('should return true if count < threshold', async () => {
            (db.drillCache.count as any).mockResolvedValue(0);
            const needsReplenish = await checkCacheStatus('user1', 'SYNTAX', 2);
            expect(needsReplenish).toBe(true);
            expect(db.drillCache.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        userId: 'user1',
                        mode: 'SYNTAX',
                        isConsumed: false
                    })
                })
            );
        });

        it('should return false if count >= threshold', async () => {
            (db.drillCache.count as any).mockResolvedValue(3);
            const needsReplenish = await checkCacheStatus('user1', 'SYNTAX', 2);
            expect(needsReplenish).toBe(false);
        });
    });
});
