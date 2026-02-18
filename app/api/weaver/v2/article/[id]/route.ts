
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createLogger } from '@/lib/logger';

const log = createLogger('api:weaver:v2:article');

/**
 * GET /api/weaver/v2/article/[id]
 * Retrieves a persisted article by ID
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        const { id } = await params;

        const article = await prisma.article.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                body: true,
                createdAt: true,
                vocabs: {
                    include: {
                        vocab: true
                    }
                }
            }
        });

        if (!article) {
            return new Response("Article not found", { status: 404 });
        }

        // Return structured content
        const bodyContent = article.body as { content: string } | null;

        // Map vocab to targetWords format
        const targetWords = article.vocabs.map((av: any) => ({
            id: av.vocab.id,
            word: av.vocab.word,
            meaning: av.vocab.definition_cn || ""
        }));

        return Response.json({
            id: article.id,
            title: article.title,
            scenario: article.title.split('-')[0].trim(), // Simple heuristic
            content: bodyContent?.content || "",
            createdAt: article.createdAt,
            targetWords,
            targetWordIds: targetWords.map((w: any) => w.id)
        });

    } catch (error) {
        log.error({ error }, 'Failed to fetch article');
        return new Response("Internal Server Error", { status: 500 });
    }
}

/**
 * DELETE /api/weaver/v2/article/[id]
 * Deletes an article by ID
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        const { id } = await params;

        // Verify ownership (optional but good practice)
        const article = await prisma.article.findUnique({
            where: { id },
            select: { userId: true }
        });

        if (!article) {
            return new Response("Article not found", { status: 404 });
        }

        if (article.userId !== session.user.id) {
            return new Response("Forbidden", { status: 403 });
        }

        await prisma.article.delete({
            where: { id }
        });

        return Response.json({ success: true });

    } catch (error) {
        log.error({ error }, 'Failed to delete article');
        return new Response("Internal Server Error", { status: 500 });
    }
}
