import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { getNextDrillWord } from '@/actions/get-next-drill';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
    prisma: mockDeep(),
}));

const mockPrisma = prisma as unknown as ReturnType<typeof mockDeep>;

describe('getNextDrillWord', () => {
    beforeEach(() => {
        mockReset(mockPrisma);
    });

    it('should prioritize Rescue Queue (Priority 1)', async () => {
        // Arrange: Mock SQL return with Priority 1 item
        const mockRescueItem = {
            vocabId: 1,
            word: 'rescue_word',
            definition_cn: 'Rescue Def',
            word_family: { v: 'rescue_word' },
            priority_level: 1,
        };

        mockPrisma.$queryRaw.mockResolvedValueOnce([mockRescueItem]);
        // Mock Context Words query
        mockPrisma.$queryRaw.mockResolvedValueOnce([{ word: 'context1' }, { word: 'context2' }, { word: 'context3' }]);

        // Act
        const result = await getNextDrillWord('user-1');

        // Assert
        expect(result?.targetWord).toBe('rescue_word');
        // Logic should have called queryRaw once for drill and once for context
        expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    });

    it('should fall back to New Acquisition if queues are empty', async () => {
        // Arrange: Mock SQL return with Priority 3 item
        const mockNewItem = {
            vocabId: 3,
            word: 'new_word',
            definition_cn: 'New Def',
            word_family: { v: 'new_word' },
            priority_level: 3,
        };

        mockPrisma.$queryRaw.mockResolvedValueOnce([mockNewItem]);
        mockPrisma.$queryRaw.mockResolvedValueOnce([{ word: 'context1' }]);

        // Act
        const result = await getNextDrillWord('user-1');

        // Assert
        expect(result?.targetWord).toBe('new_word');
    });

    it('should return null if no candidates found', async () => {
        // Arrange
        mockPrisma.$queryRaw.mockResolvedValueOnce([]);

        // Act
        const result = await getNextDrillWord('user-1');

        // Assert
        expect(result).toBeNull();
    });

    it('should filter context words correctly', async () => {
        // Arrange
        const mockDrill = {
            vocabId: 1,
            word: 'target',
            definition_cn: 'def',
            word_family: {},
            priority_level: 1,
        };

        mockPrisma.$queryRaw.mockResolvedValueOnce([mockDrill]);

        // Mock Context: Returns 3 valid words
        const mockContext = [
            { word: 'valid_noun' },
            { word: 'valid_adj' },
            { word: 'valid_noun_2' }
        ];
        mockPrisma.$queryRaw.mockResolvedValueOnce(mockContext);

        // Act
        const result = await getNextDrillWord('user-1');

        // Assert
        expect(result?.contextWords).toHaveLength(3);
        expect(result?.contextWords).toContain('valid_noun');
    });
});
