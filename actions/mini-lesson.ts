'use server';

import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/db';
import { AIService } from '@/lib/ai/core';
import { WandPrompts } from '@/lib/generators/wand-prompts';
import { logger } from '@/lib/logger';

const log = logger.child({ module: 'mini-lesson' });

// ---------------------------------------------------------------------------
// 输入/输出 Schema
// ---------------------------------------------------------------------------

const inputSchema = z.object({
    questionSeedId: z.string(),
    selectedOption: z.string(),
});

const miniLessonSchema = z.object({
    errorAnalysis: z.string(),
    grammarOverview: z.string(),
    exampleSentences: z.array(z.string()).min(1).max(3),
});

export type MiniLessonData = z.infer<typeof miniLessonSchema> & {
    grammarNodeName: string;
};

export type MiniLessonResponse =
    | { mode: 'rationale' }
    | { mode: 'mini-lesson'; miniLesson: MiniLessonData };

/** masteryScore 低于此值触发微课 */
const MINI_LESSON_THRESHOLD = 0.3;

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

/**
 * 获取 Mini-Lesson 微课内容。
 * 
 * 触发条件：用户答错 + 该语法节点 masteryScore < 0.3。
 * Fail-Safe：LLM 失败时降级为 { mode: 'rationale' }。
 */
export async function fetchMiniLesson(
    payload: z.infer<typeof inputSchema>
): Promise<MiniLessonResponse> {
    try {
        // 0. Auth
        const session = await auth();
        if (!session?.user?.id) return { mode: 'rationale' };
        const userId = session.user.id;

        const input = inputSchema.parse(payload);

        // 1. 查询 QuestionSeed → grammarNodeId + 题目信息
        const seed = await prisma.questionSeed.findUnique({
            where: { id: input.questionSeedId },
            select: {
                grammarNodeId: true,
                sentence: true,
                targetAnswer: true,
                rationale: true,
                passage: { select: { content: true } }
            },
        });

        if (!seed?.grammarNodeId) return { mode: 'rationale' };

        // 2. 独立查询 masteryScore（🔴 不依赖 BKT fire-and-forget 时序）
        const proficiency = await prisma.userGrammarProficiency.findUnique({
            where: { userId_grammarNodeId: { userId, grammarNodeId: seed.grammarNodeId } },
            select: { masteryScore: true },
        });

        // masteryScore 为 null 表示首次遇到（冷启动 0.5），不触发微课
        const mastery = proficiency?.masteryScore ?? 0.5;
        if (mastery >= MINI_LESSON_THRESHOLD) return { mode: 'rationale' };

        // 3. 查询 GrammarNode 信息
        const grammarNode = await prisma.grammarNode.findUnique({
            where: { id: seed.grammarNodeId },
            select: { name: true, description: true },
        });

        if (!grammarNode) return { mode: 'rationale' };

        // 4. 通过 AIService Facade 生成微课（Prompt 来自 WandPrompts）
        const { system, user } = WandPrompts.miniLesson({
            grammarNodeName: grammarNode.name,
            grammarNodeDescription: grammarNode.description || '',
            sentence: seed.sentence === "" && seed.passage ? `(此为空白插入题，请结合长文语境分析)\n${seed.passage.content}` : seed.sentence,
            targetAnswer: seed.targetAnswer,
            selectedOption: input.selectedOption,
        });

        const { object } = await AIService.generateObject({
            mode: 'fast',
            userId,
            schema: miniLessonSchema,
            system,
            prompt: user,
            temperature: 0.3,
        });

        log.info({
            userId,
            grammarNodeId: seed.grammarNodeId,
            mastery,
        }, '[Mini-Lesson] Generated successfully');

        return {
            mode: 'mini-lesson',
            miniLesson: {
                ...object,
                grammarNodeName: grammarNode.name,
            },
        };

    } catch (err) {
        // Fail-Safe：任何错误都降级为 rationale
        log.error({ err }, '[Mini-Lesson] Generation failed, falling back to rationale');
        return { mode: 'rationale' };
    }
}

