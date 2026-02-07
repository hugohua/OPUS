import { NextRequest, NextResponse } from 'next/server';
import { handleOpenAIStream, buildMessages } from '@/lib/streaming/sse';
import { ProviderRegistry } from '@/lib/ai/providers';
import OpenAI from 'openai';
import { AUDIT_SYSTEM_PROMPT, getAuditUserPrompt, AuditResult } from '@/lib/generators/audit/quality-auditor';
import { createAuditRecord } from '@/actions/audit-actions';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { targetWord, contextMode, payload } = body;

        console.log('[AuditAPI] Request:', {
            hasTarget: !!targetWord,
            hasPayload: !!payload,
            keys: Object.keys(body)
        });

        if (!targetWord || !payload) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Prepare Prompts
        const segments = payload.segments || [];
        const interaction = segments.find((s: any) => s.type === 'interaction');

        if (!interaction) {
            return NextResponse.json({ error: 'No interaction found in payload' }, { status: 400 });
        }

        const question = interaction.task?.question_markdown || "";
        const options = interaction.task?.options || [];
        const answer = interaction.task?.answer_key || "";

        const userPrompt = getAuditUserPrompt({
            targetWord,
            contextMode,
            question,
            options,
            answer
        });

        const messages = buildMessages(userPrompt, AUDIT_SYSTEM_PROMPT);

        // 2. Select Provider (Smart Mode)
        // Use unified ProviderRegistry to get config for 'smart' mode (ETL/Audit priority)
        const providers = ProviderRegistry.getFailoverList('smart');

        if (providers.length === 0) {
            return NextResponse.json({ error: 'No available LLM providers' }, { status: 500 });
        }

        const provider = providers[0];
        console.log('[AuditAPI] Using provider:', provider.id, provider.modelId);

        // 3. Create OpenAI Client
        const client = new OpenAI({
            apiKey: provider.apiKey,
            baseURL: provider.baseURL,
        });

        // 4. Stream Response
        return handleOpenAIStream(messages, {
            client, // Inject custom client
            model: provider.modelId, // Use provider's model (Unified Config)
            temperature: 0.2, // Low temp for deterministic critique
            errorContext: "Audit Stream",
            onComplete: async (fullText) => {
                try {
                    console.log('[AuditAPI] Stream complete. Parsing JSON...');
                    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const result = JSON.parse(jsonMatch[0]) as AuditResult;

                        await createAuditRecord({
                            targetWord,
                            contextMode,
                            payload,
                            status: 'AUDIT',
                            auditScore: result.score,
                            auditReason: result.reason,
                            isRedundant: result.redundancy_detected
                        });
                        console.log('[AuditAPI] Audit record saved.');
                    } else {
                        console.error('[AuditAPI] Failed to extract JSON from response:', fullText);
                    }
                } catch (e) {
                    console.error('[AuditAPI] Failed to save audit record:', e);
                }
            }
        });

    } catch (error) {
        console.error('[AuditAPI] Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
