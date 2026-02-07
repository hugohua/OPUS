import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processDrillJob } from '../drill-processor';
import { inventory } from '@/lib/core/inventory';
import { CACHE_LIMIT_MAP } from '@/lib/drill-cache';

// Mock dependencies
vi.mock('@/lib/db', () => ({
    db: {
        vocab: { findMany: vi.fn() },
        userProgress: { findMany: vi.fn() },
        $queryRaw: vi.fn(),
    }
}));

vi.mock('@/lib/core/inventory', () => ({
    inventory: {
        getInventoryStats: vi.fn(),
        getInventoryCounts: vi.fn(),
        pushDrill: vi.fn(),
        isFull: vi.fn(),
        getCapacity: vi.fn(),
    }
}));

vi.mock('@/lib/drill-cache', () => ({
    CACHE_LIMIT_MAP: {
        SYNTAX: 5, // 50 drills
    }
}));

vi.mock('@/lib/ai/core', () => ({
    AIService: {
        generateObject: vi.fn(),
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        child: () => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        })
    },
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    })
}));

// Mock services/omps-core to avoid complex setup
vi.mock('@/lib/services/omps-core', () => ({
    fetchOMPSCandidates: vi.fn().mockResolvedValue([]), // Return empty to stop execution after check
}));

describe('Inventory Limit Enforcement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should skip generation if inventory is full (Defense in Depth)', async () => {
        // Setup state: SYNTAX limit is 5 batches * 10 = 50.
        // Mock current inventory as 50 (Full)
        // Mock isFull = true
        (inventory.isFull as any).mockResolvedValue(true);
        // Mock stats just in case logging needs it
        (inventory.getInventoryStats as any).mockResolvedValue({
            SYNTAX: 50,
        });
        (inventory.getCapacity as any).mockResolvedValue(50);

        const job = {
            name: 'generate-SYNTAX',
            data: {
                userId: 'user-full-test',
                mode: 'SYNTAX',
                correlationId: 'test-limit',
                // No vocabIds -> Generic Fetch
                // 'long' mode removed, Context now uses 'fast'
                // We can add a test case for 'fast' mode with context input if needed, 
                // but for now let's just ensure we test the supported modes.
            }
        } as any;
        const result = await processDrillJob(job);

        // Assert
        expect(result.success).toBe(true);
        expect(result.count).toBe(0);
        expect(result.reason).toBe('inventory_full_pre_check');
        // omps fetch should NOT be called
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        expect(fetchOMPSCandidates).not.toHaveBeenCalled();
    });

    it('should proceed if inventory is not full', async () => {
        // Setup state: SYNTAX limit is 50.
        // Mock current inventory as 40.
        // Mock isFull = false
        (inventory.isFull as any).mockResolvedValue(false);
        (inventory.getInventoryStats as any).mockResolvedValue({
            SYNTAX: 40,
        });
        (inventory.getCapacity as any).mockResolvedValue(50);

        // Mock OMPS to return empty to stop downstream logical errors, 
        // but we just want to verify we PASSED the check.
        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        (fetchOMPSCandidates as any).mockResolvedValue([]);

        const job = {
            name: 'generate-SYNTAX',
            data: {
                userId: 'user-partial-test',
                mode: 'SYNTAX',
                correlationId: 'test-pass',
            }
        } as any;

        const result = await processDrillJob(job);

        // Assert: It should NOT be 'inventory_full_pre_check'
        // Since OMPS returns empty, processDrillJob returns success: false, reason: 'no_candidates' (or similar based on code)
        // Let's check drill-processor Step 84: if candidates empty -> reason: 'no_candidates'
        // But BEFORE that, it calls fetchDueCandidates -> calls OMPS.

        expect(fetchOMPSCandidates).toHaveBeenCalled();
    });

    it('should respect dynamic effective limit', async () => {
        // Limit 50. Current 45. Gap 5.
        // Job requests 10.
        // Effective limit should be 5.

        // Limit 50. Current 45. Gap 5.
        // Job requests 10.
        // Effective limit should be 5.

        (inventory.getCapacity as any).mockResolvedValue(50);
        (inventory.getInventoryStats as any).mockResolvedValue({
            SYNTAX: 45,
        });

        const { fetchOMPSCandidates } = await import('@/lib/services/omps-core');
        (fetchOMPSCandidates as any).mockResolvedValue([]);

        const job = {
            name: 'generate-SYNTAX',
            data: {
                userId: 'user-dynamic-test',
                mode: 'SYNTAX',
                correlationId: 'test-dynamic',
                forceLimit: 10
            }
        } as any;

        await processDrillJob(job);

        // Assert
        // fetchDueCandidates(userId, mode, limit) is called with limit
        // fetchDueCandidates internal calls fetchOMPSCandidates with bufferLimit = limit * 2
        // We can't spy on fetchDueCandidates easily since it's in the same module (if not exported/mocked) 
        // BUT fetchDueCandidates is defined in drill-processor.ts?
        // Wait, fetchDueCandidates is defined inside drill-processor.ts at the bottom.
        // We can check arguments to fetchOMPSCandidates.
        // fetchDueCandidates calls fetchOMPSCandidates(..., bufferLimit, ...)
        // bufferLimit = limit * 2. 
        // If effective limit is 5, bufferLimit should be 10.

        expect(fetchOMPSCandidates).toHaveBeenCalledWith(
            expect.anything(),
            10, // 5 * 2 = 10
            expect.anything(),
            expect.anything(),
            'SYNTAX'
        );
    });
});
