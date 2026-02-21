"use client";

import { useSession } from "next-auth/react";
import { SessionRunner } from "@/components/session/session-runner";

export default function ArenaPart5Page() {
    const { data: session } = useSession();

    if (!session?.user?.id) {
        return null; // Handle loading or authentication state properly in production
    }

    return (
        <div className="min-h-[100dvh] bg-background flex flex-col relative w-full h-full overflow-hidden">
            {/* SessionRunner handles the entirely of the fetching, UI mapping, and logic */}
            <SessionRunner
                userId={session.user.id}
                mode="ARENA_PART5"
            />
        </div>
    );
}
