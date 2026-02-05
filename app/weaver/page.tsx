"use client";

import React, { useState } from "react";
import { WeaverConsole } from "@/components/weaver/WeaverConsole";
import { ArticleReader } from "@/components/weaver/ArticleReader";

export default function WeaverPage() {
    const [mode, setMode] = useState<"setup" | "reading">("setup");

    // State to pass from Console to Reader
    const [config, setConfig] = useState<{
        scenario: string;
        targetWordIds: number[];
        targetWords: Array<{ id: number; word: string; meaning: string }>;
    } | null>(null);

    return (
        <div className="relative min-h-screen w-full bg-background text-foreground font-sans antialiased flex flex-col selection:bg-indigo-500/30">

            {/* Background Grid Pattern (Neutral) */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none fixed" />

            {/* Ambient Background Glow (Dark Mode Only Enhancement) */}
            <div className={`fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none dark:block hidden`} />

            {/* Content Container */}
            <div className="relative z-10 flex-1 flex flex-col">
                {mode === "setup" ? (
                    <WeaverConsole
                        onStart={(scenario, words) => {
                            setConfig({
                                scenario,
                                targetWordIds: words.map(w => w.id),
                                targetWords: words
                            });
                            setMode("reading");
                        }}
                    />
                ) : (
                    config && (
                        <ArticleReader
                            scenario={config.scenario}
                            targetWordIds={config.targetWordIds}
                            targetWords={config.targetWords}
                            onBack={() => {
                                setMode("setup");
                                setConfig(null);
                            }}
                        />
                    )
                )}
            </div>
        </div>
    );
}
