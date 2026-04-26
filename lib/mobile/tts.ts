import { z } from "zod";

import { getTTSAudioCore } from "@/lib/tts/service";

const MobileTTSSchema = z.object({
    text: z.string().trim().min(1),
    voice: z.string().optional(),
    language: z.string().optional(),
    speed: z.number().min(0.5).max(2).optional(),
    cacheType: z.enum(["vocab", "phrase", "temporary"]).optional(),
});

export async function generateMobileTTS(input: unknown, requestURL: string) {
    const validated = MobileTTSSchema.parse(input);
    const result = await getTTSAudioCore(validated);
    const origin = new URL(requestURL).origin;

    return {
        ...result,
        audioUrl: new URL(result.url, origin).toString(),
    };
}
