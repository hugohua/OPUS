import React from "react";
import { AudioSessionRunner } from "@/components/session/audio-session-runner";

export const metadata = {
    title: "听力训练 | Opus",
    description: "闭眼模式听力练习"
};

export default function AudioDrillPage() {
    return (
        <main className="w-full h-[100dvh] bg-zinc-50 dark:bg-zinc-950">
            <AudioSessionRunner />
        </main>
    );
}
