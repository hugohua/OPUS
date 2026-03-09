/**
* Get Blitz Session Action
* 功能：
*   获取极速跟读模式 (Phrase Blitz) 的复习队列
* 逻辑：
*   [V3] 迁移至 OMPS 统一选词引擎
*   采用 OMPS_ARENA_CONFIG (30/50/20) 协议
*   Phrase Mask 生成保留独立逻辑
*/
'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { BlitzSessionData } from '@/lib/validations/blitz';
import { fetchOMPSCandidates, OMPS_ARENA_CONFIG } from '@/lib/services/omps-core';
import { redirect } from 'next/navigation';

const log = createLogger('actions:get-blitz-session');

const TOTAL_COUNT = 20;

export async function getBlitzSession(): Promise<ActionState<BlitzSessionData>> {
    const session = await auth();
    if (!session?.user?.id) {
        redirect('/login');
    }

    try {
        const userId = session.user.id;

        log.info({ userId }, 'Starting Blitz Session (OMPS V3 Arena Protocol)');

        // ==========================================
        // 1. OMPS 统一选词 (30/50/20)
        // ==========================================
        const candidates = await fetchOMPSCandidates(
            userId,
            TOTAL_COUNT,
            OMPS_ARENA_CONFIG,
            [],
            'BLITZ'
        );

        if (candidates.length === 0) {
            return {
                status: 'success',
                message: 'No items available for session',
                data: { sessionId: crypto.randomUUID(), items: [] }
            };
        }

        log.info({
            total: candidates.length,
            rescue: candidates.filter(c => c.source === 'rescue').length,
            review: candidates.filter(c => c.source === 'review' || c.source === 'hot').length,
            new: candidates.filter(c => c.source === 'new').length,
        }, 'OMPS candidates received');

        // ==========================================
        // 2. 补充 collocations（OMPS 不返回此字段）
        // ==========================================
        const vocabIds = candidates.map(c => c.vocabId);
        const vocabsWithCollocations = await prisma.vocab.findMany({
            where: { id: { in: vocabIds } },
            select: { id: true, collocations: true }
        });
        const collocMap = new Map(vocabsWithCollocations.map(v => [v.id, v.collocations]));

        // ==========================================
        // 3. Transform & Mask (Phrase 生成)
        // ==========================================
        const items = candidates.map(c => {
            const word = c.word;
            let collocations: any[] = [];

            const rawColloc = collocMap.get(c.vocabId);
            if (Array.isArray(rawColloc)) {
                collocations = rawColloc;
            }

            // Fallback Logic
            let chosenPhrase = {
                text: word,
                trans: c.definition_cn || '暂无释义'
            };

            if (collocations.length > 0) {
                const randomIndex = Math.floor(Math.random() * collocations.length);
                const selected = collocations[randomIndex];
                if (selected && typeof selected === 'object') {
                    chosenPhrase = {
                        text: selected.text || word,
                        trans: selected.trans || '暂无释义'
                    };
                }
            }

            // Generate Mask (Case Insensitive, Word Boundary)
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const maskRegex = new RegExp(`\\b${escapedWord}(?:s|es|d|ed|ing)?\\b`, 'gi');
            const maskedText = chosenPhrase.text.replace(maskRegex, '_______');

            return {
                id: `blitz-${c.vocabId}`,
                vocabId: c.vocabId,
                word: word,
                frequency_score: c.frequency_score,
                track: 'VISUAL' as const,
                context: {
                    text: chosenPhrase.text,
                    maskedText: maskedText,
                    translation: chosenPhrase.trans,
                }
            };
        });

        // Final Shuffle
        const shuffledItems = items.sort(() => Math.random() - 0.5);

        log.info({ totalItems: shuffledItems.length }, 'Session Generated Successfully');

        return {
            status: 'success',
            message: 'Session generated',
            data: {
                sessionId: crypto.randomUUID(),
                items: shuffledItems
            }
        };

    } catch (error: any) {
        log.error({ error }, 'Failed to get blitz session');
        return {
            status: 'error',
            message: 'Failed to generate session'
        };
    }
}
