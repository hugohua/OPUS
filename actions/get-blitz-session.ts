/**
* Get Blitz Session Action
* 功能：
*   获取极速跟读模式 (Phrase Blitz) 的复习队列
* 逻辑：
*   1. 筛选: userId, status=[LEARNING, REVIEW], next_review_at <= NOW (只复习到期的)
*   2. 排序: 
*      - 第一优先级: 热度 (frequency_score DESC) -> "生存优先"
*      - 第二优先级: 逾期时间 (next_review_at ASC)
*   3. 构造:
*      - 随机选取 Collocation
*      - 生成 Mask (Case Insensitive)
*/
'use server';

import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { createLogger } from '@/lib/logger';
import { ActionState } from '@/types/action';
import { BlitzSessionData } from '@/lib/validations/blitz';
import { redirect } from 'next/navigation';

const log = createLogger('actions:get-blitz-session');

export async function getBlitzSession(): Promise<ActionState<BlitzSessionData>> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            redirect('/login');
        }

        const userId = session.user.id;
        const now = new Date();

        // 1. Fetch Candidates
        // 规则: status != MASTERED 且 next_review_at <= NOW
        const candidates = await prisma.userProgress.findMany({
            where: {
                userId,
                track: 'VISUAL', // [Fix] Blitz is essentially a Visual/Syntax drill
                status: {
                    in: ['LEARNING', 'REVIEW', 'NEW'] // 排除 MASTERED
                },
                next_review_at: { lte: now } // 严格复习模式: 只给到期的
            },
            include: {
                vocab: {
                    select: {
                        id: true,
                        word: true,
                        frequency_score: true,
                        collocations: true,
                        definition_cn: true,
                    }
                }
            },
            orderBy: [
                { vocab: { frequency_score: 'desc' } }, // Heat First
                { next_review_at: 'asc' },              // Then Overdue
            ],
            take: 20
        });

        if (candidates.length === 0) {
            return {
                status: 'success',
                message: 'No items due for review',
                data: {
                    sessionId: crypto.randomUUID(),
                    items: []
                }
            };
        }

        // 2. Transform & Mask
        const items = candidates.map(p => {
            const word = p.vocab.word;
            let collocations: any[] = [];

            // 确保 collocations 是数组
            if (Array.isArray(p.vocab.collocations)) {
                collocations = p.vocab.collocations;
            }

            // Fallback: 如果没有 Collocation，用单词本身 (虽不理想，但保证不报错)
            let chosenPhrase = {
                text: word,
                trans: p.vocab.definition_cn || '暂无释义'
            };

            if (collocations.length > 0) {
                // Randomly select one
                const randomIndex = Math.floor(Math.random() * collocations.length);
                const selected = collocations[randomIndex];
                if (selected && typeof selected === 'object') {
                    chosenPhrase = {
                        text: selected.text || word,
                        trans: selected.trans || '暂无释义'
                    };
                }
            }

            // Generate Mask (Case Insensitive)
            // 将目标词替换为 _______
            const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const maskRegex = new RegExp(escapedWord, 'gi');

            // 如果正则匹配不到 (例如词形变化 big/bigger)，暂时不处理复杂词形还原，直接尝试匹配
            // 若未匹配，则 maskedText = text (显示原句，这是 Level 0 可接受的 fallback)
            const maskedText = chosenPhrase.text.replace(maskRegex, '_______');

            return {
                id: p.id,
                vocabId: p.vocab.id,
                word: word,
                frequency_score: p.vocab.frequency_score,
                context: {
                    text: chosenPhrase.text,
                    maskedText: maskedText,
                    translation: chosenPhrase.trans,
                }
            };
        });

        return {
            status: 'success',
            message: 'Session generated',
            data: {
                sessionId: crypto.randomUUID(),
                items
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
