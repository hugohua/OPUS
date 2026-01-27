'use server';

import 'server-only';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { WordSelectionService } from '@/lib/services/WordSelectionService';
import { ArticleAIService } from '@/lib/ai/ArticleAIService';
import { ActionState } from '@/types';
import { GenerateArticleInputSchema } from '@/lib/validations/article';
import { GeneratedArticle } from '@/types/article';
import { createLogger } from '@/lib/logger';
import { Article, ArticleVocab, Vocab, VocabRole } from '@prisma/client';

const log = createLogger('action:article');

/**
 * 生成每日文章 Action
 * 
 * 1. 选词 (Target + Context)
 * 2. AI 生成文章
 * 3. 入库 (Article + ArticleVocab)
 */
export async function generateDailyArticleAction(
    input: { userId?: string } = {}
): Promise<ActionState<GeneratedArticle & { id: string }>> {
    const startTime = Date.now();

    // 1. 输入验证
    const validation = GenerateArticleInputSchema.safeParse(input);
    if (!validation.success) {
        return {
            status: 'error',
            message: '输入无效',
            fieldErrors: validation.error.flatten().fieldErrors as Record<string, string>,
        };
    }

    // 使用传入的 ID 或默认测试账号 (Task 3.1 前临时策略)
    const userId = input.userId || 'test-user-1';

    try {
        log.info({ userId }, 'Starting daily article generation');

        // 2. 选词
        const selectionService = new WordSelectionService(userId);
        const selection = await selectionService.getWordSelection();

        if (!selection) {
            log.info({ userId }, 'No target word found for today');
            return {
                status: 'error',
                message: '今日无新词可学 (所有高优先级词汇已掌握或无场景标签)',
            };
        }

        const { targetWord, contextWords, scenario } = selection;

        // 3. AI 生成
        const aiService = new ArticleAIService();
        const generatedArticle = await aiService.generateArticle({
            targetWord: {
                id: targetWord.id,
                word: targetWord.word,
                definition_cn: targetWord.definition_cn,
                scenarios: targetWord.scenarios,
            },
            contextWords: contextWords.map(w => ({
                id: w.id,
                word: w.word,
                definition_cn: w.definition_cn,
                scenarios: w.scenarios,
            })),
            scenario: scenario as any, // Zod enum compatibility
        });

        // 4. 入库 (使用事务确保原子性)
        const savedArticle = await prisma.$transaction(async (tx) => {
            // 4.1 确保用户存在 (临时逻辑，生产环境应由 Auth 保证)
            let user = await tx.user.findUnique({ where: { id: userId } });
            if (!user) {
                // 如果是硬编码的测试用户，自动创建
                if (userId === 'test-user-1') {
                    user = await tx.user.create({
                        data: {
                            id: userId,
                            email: 'test@example.com',
                            name: 'Test User',
                            password: '$2b$10$Zdm79t9NLUZ1qND8iVXRD.BZiPOJMDkHy9Uh/5BRbb/AQynEXgPMe', // 123456
                        }
                    });
                } else {
                    throw new Error(`User ${userId} not found`);
                }
            }

            // 4.2 创建文章记录
            const article = await tx.article.create({
                data: {
                    userId,
                    title: generatedArticle.title,
                    body: generatedArticle.body, // Json
                    summaryZh: generatedArticle.summaryZh,
                },
            });

            // 4.3 创建 Target 关联
            await tx.articleVocab.create({
                data: {
                    articleId: article.id,
                    vocabId: targetWord.id,
                    role: VocabRole.TARGET,
                },
            });

            // 4.4 创建 Context 关联
            for (const contextWord of contextWords) {
                await tx.articleVocab.create({
                    data: {
                        articleId: article.id,
                        vocabId: contextWord.id,
                        role: VocabRole.CONTEXT,
                    },
                });
            }

            return article;
        });

        const duration = Date.now() - startTime;
        log.info({
            articleId: savedArticle.id,
            duration,
            targetWord: targetWord.word
        }, 'Article generation completed');

        // 5. 刷新缓存
        revalidatePath('/dashboard');
        revalidatePath('/reader');

        return {
            status: 'success',
            message: '文章生成成功',
            data: {
                ...generatedArticle,
                id: savedArticle.id,
            },
        };

    } catch (error) {
        log.error({ userId, error }, 'Failed to generate article');
        return {
            status: 'error',
            message: error instanceof Error ? error.message : '文章生成服务暂时不可用',
        };
    }
}
