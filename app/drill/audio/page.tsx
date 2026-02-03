import React from "react";
import { AudioSessionRunner } from "@/components/session/audio-session-runner";

export const metadata = {
    title: "Audio Gym | Opus",
    description: "Eyes-free audio practice session."
};

export default function AudioDrillPage() {
    return (
        <main className="w-full h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
            <AudioSessionRunner />
        </main>
    );
}
