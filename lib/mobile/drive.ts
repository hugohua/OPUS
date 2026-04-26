import { z } from "zod";

import { generateDrivePlaylistForUser } from "@/lib/drive/playlist";
import { BATCH_SIZE_OPTIONS, REVIEW_MODES } from "@/lib/constants/review-modes";

const DrivePlaylistQuerySchema = z.object({
    mode: z.enum(Object.keys(REVIEW_MODES) as [keyof typeof REVIEW_MODES, ...Array<keyof typeof REVIEW_MODES>]).default("SANDWICH"),
    track: z.enum(["VISUAL", "AUDIO", "CONTEXT"]).default("VISUAL"),
    batch: z.coerce.number().refine(
        (value) => (BATCH_SIZE_OPTIONS as readonly number[]).includes(value),
        "Unsupported batch size"
    ).default(50),
});

export type MobileDrivePlaylistQuery = z.input<typeof DrivePlaylistQuerySchema>;

export function getMobileDrivePlaylist(query: MobileDrivePlaylistQuery, userId: string) {
    const validated = DrivePlaylistQuerySchema.safeParse(query);
    if (!validated.success) {
        throw new Error("Invalid drive playlist options");
    }

    const batchSize = validated.data.batch;
    return generateDrivePlaylistForUser(userId, {
        mode: validated.data.mode,
        track: validated.data.track,
        batchSize,
    }).then((playlist) => ({
        ...playlist,
        batchSize,
    }));
}
