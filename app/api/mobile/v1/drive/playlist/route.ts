import { createMobileErrorEnvelope, createMobileSuccessEnvelope, mobileInternalErrorResponse, mobileUnauthorizedResponse, requireMobileSession } from "@/lib/mobile/contracts";
import { getMobileDrivePlaylist, type MobileDrivePlaylistQuery } from "@/lib/mobile/drive";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const session = await requireMobileSession(request);
    if (!session) {
        return mobileUnauthorizedResponse();
    }

    try {
        const { searchParams } = new URL(request.url);
        const payload = await getMobileDrivePlaylist(
            {
                mode: (searchParams.get("mode") as MobileDrivePlaylistQuery["mode"]) ?? undefined,
                track: (searchParams.get("track") as MobileDrivePlaylistQuery["track"]) ?? undefined,
                batch: searchParams.get("batch") ?? undefined,
            },
            session.user.id
        );

        return Response.json(createMobileSuccessEnvelope(payload));
    } catch (error) {
        if (error instanceof Error && error.message === "Invalid drive playlist options") {
            return Response.json(
                createMobileErrorEnvelope("VALIDATION_ERROR", error.message),
                { status: 400 }
            );
        }

        return mobileInternalErrorResponse(error instanceof Error ? error.message : "Internal server error");
    }
}
