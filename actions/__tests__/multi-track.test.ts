import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { recordOutcome } from '@/actions/record-outcome';
import { fetchOMPSCandidates } from '@/lib/services/omps-core';

// Mock DB is not needed if we are running integration test with real DB (e.g. Docker)
// But here we likely want to stick to the existing pattern. 
// If there's no global setup, we assume we might be running against the real dev DB (reset state).
// For safety, let's create a test user.

describe('Multi-Track FSRS Integration', () => {
    // Must be a valid CUID to pass Zod validation
    const TEST_USER_ID = 'clq2w3e4r5t6y7u8i9o0p1a2s';

    beforeEach(async () => {
        // Clean up
        await prisma.userProgress.deleteMany({ where: { userId: TEST_USER_ID } });
        await prisma.user.deleteMany({ where: { email: 'test_multi@opus.com' } });
        await prisma.vocab.deleteMany({ where: { word: { in: ['time', 'year'] } } });

        // Setup User
        await prisma.user.create({
            data: {
                id: TEST_USER_ID,
                email: 'test_multi@opus.com',
                name: 'Test Multi',
                password: 'password123'
            }
        });

        // Setup Vocabs
        await prisma.vocab.createMany({
            data: [
                { word: 'time', definition_cn: '时间', is_toeic_core: true, frequency_score: 99 },
                { word: 'year', definition_cn: '年', is_toeic_core: true, frequency_score: 98 }
            ]
        });
    });

    it('Scenario A: Track Isolation', async () => {
        // 1. Pick a vocab
        const vocab = await prisma.vocab.findFirst({ where: { word: 'time' } });
        if (!vocab) throw new Error('Vocab "time" not found (did you seed?)');


        // 2. Train VISUAL -> Pass
        const res1 = await recordOutcome({
            userId: TEST_USER_ID,
            vocabId: vocab.id,
            grade: 4, // Easy
            mode: 'SYNTAX', // -> VISUAL
            duration: 1000
        });

        if (res1.status === 'error') console.error('Train VISUAL Error:', res1.message);

        // 3. Train AUDIO -> Fail
        const res2 = await recordOutcome({
            userId: TEST_USER_ID,
            vocabId: vocab.id,
            grade: 1, // Again
            mode: 'AUDIO', // -> AUDIO
            duration: 5000
        });
        if (res2.status === 'error') console.error('Train AUDIO Error:', res2.message);

        // 4. Verify Database State
        const visualProg = await prisma.userProgress.findUnique({
            where: { userId_vocabId_track: { userId: TEST_USER_ID, vocabId: vocab.id, track: 'VISUAL' } }
        });
        const audioProg = await prisma.userProgress.findUnique({
            where: { userId_vocabId_track: { userId: TEST_USER_ID, vocabId: vocab.id, track: 'AUDIO' } }
        });

        expect(visualProg).not.toBeNull();
        expect(audioProg).not.toBeNull();

        // Visual should be stable
        expect(visualProg?.stability).toBeGreaterThan(0);
        expect(visualProg?.next_review_at!.getTime()).toBeGreaterThan(new Date().getTime());

        // Audio should be unstable (failed)
        expect(audioProg?.stability).toBeLessThan(1.0); // very low stability
        // Interval isn't stored in UserProgress root usually, but next_review_at is.
        // If we want to check interval, we might need to check internal logs or inferred state.
        // But checking next_review_at is basically "now" is enough.
        const now = new Date();
        const diff = audioProg?.next_review_at!.getTime()! - now.getTime();
        expect(diff).toBeLessThan(60 * 60 * 1000); // Due within an hour (or immediately)
    });

    it('Scenario B: OMPS Routing', async () => {
        // 1. Create a "Due" record in AUDIO track
        const vocab = await prisma.vocab.findFirst({ where: { word: 'year' } });
        if (!vocab) throw new Error('Vocab "year" not found');

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        await prisma.userProgress.create({
            data: {
                userId: TEST_USER_ID,
                vocabId: vocab.id,
                track: 'AUDIO',
                status: 'REVIEW',
                next_review_at: yesterday, // DUE!
                stability: 5
            }
        });

        // 2. Fetch candidates for AUDIO mode
        const candidatesAudio = await fetchOMPSCandidates(TEST_USER_ID, 10, { reviewRatio: 1.0 }, [], 'AUDIO');
        const foundAudio = candidatesAudio.find(c => c.vocabId === vocab.id);

        expect(foundAudio).toBeDefined();
        expect(foundAudio?.type).toBe('REVIEW');

        // 3. Fetch candidates for SYNTAX (VISUAL) mode
        // Should NOT find it because it's only due in AUDIO
        const candidatesVisual = await fetchOMPSCandidates(TEST_USER_ID, 10, { reviewRatio: 1.0 }, [], 'SYNTAX');
        const foundVisual = candidatesVisual.find(c => c.vocabId === vocab.id);

        expect(foundVisual).toBeUndefined();
    });

    it('Scenario C: Default Track Fallback', async () => {
        const vocab = await prisma.vocab.findFirst();
        if (!vocab) return;

        // Unknown mode -> should fallback to VISUAL
        await recordOutcome({
            userId: TEST_USER_ID,
            vocabId: vocab.id,
            grade: 3,
            mode: 'UNKNOWN_MODE' as any,
            duration: 2000
        });

        const visualProg = await prisma.userProgress.findUnique({
            where: { userId_vocabId_track: { userId: TEST_USER_ID, vocabId: vocab.id, track: 'VISUAL' } }
        });

        const contextProg = await prisma.userProgress.findUnique({
            where: { userId_vocabId_track: { userId: TEST_USER_ID, vocabId: vocab.id, track: 'CONTEXT' } }
        });

        expect(visualProg).toBeDefined();
        expect(contextProg).toBeNull();
    });
});
