"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WeaverConsole } from "@/components/weaver/WeaverConsole";
import { ArticleReader } from "@/components/weaver/ArticleReader";
import { FloatingDockClient } from "@/components/dashboard/floating-dock-client";

function WeaverContent() {
    const searchParams = useSearchParams();
    const id = searchParams.get("id");

    const [mode, setMode] = useState<"setup" | "reading">(() => id ? "reading" : "setup");

    // State to pass from Console to Reader
    const [config, setConfig] = useState<{
        scenario: string;
        density: string;
        targetWordIds: number[];
        targetWords: Array<{ id: number; word: string; meaning: string }>;
    } | null>(() => id ? {
        scenario: "", // Empty to show skeleton
        density: "balanced",
        targetWordIds: [],
        targetWords: []
    } : null);

    // Update if ID changes (e.g. navigation) - keeping this for reactivity
    useEffect(() => {
        if (id && mode !== "reading") {
            setMode("reading");
            setConfig({
                scenario: "",
                density: "balanced",
                targetWordIds: [],
                targetWords: []
            });
        }
    }, [id]);

    return (
        <div className="relative z-10 flex-1 flex flex-col">
            {mode === "setup" ? (
                <WeaverConsole
                    onStart={(scenario, density, words) => {
                        setConfig({
                            scenario,
                            density,
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
                        density={config.density}
                        targetWordIds={config.targetWordIds}
                        targetWords={config.targetWords}
                        onBack={() => {
                            setMode("setup");
                            setConfig(null);
                            // Clear URL ID
                            window.history.replaceState(null, "", "/weaver");
                        }}
                    />
                )
            )}
        </div>
    );
}

export default function WeaverPage() {
    return (
        <div className="relative min-h-screen w-full bg-background text-foreground font-sans antialiased flex justify-center selection:bg-indigo-500/30">

            {/* Background Grid Pattern (Neutral) */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none fixed" />

            {/* Ambient Background Glow (Dark Mode Only) */}
            <div className="fixed top-0 left-0 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent pointer-events-none dark:block hidden" />

            {/* Content Container (Mobile First) */}
            <div className="w-full max-w-md bg-transparent min-h-screen shadow-2xl ring-1 ring-border/5 relative flex flex-col z-10">
                <Suspense fallback={<WeaverSkeleton />}>
                    <WeaverContent />
                </Suspense>
                <FloatingDockClient />
            </div>
        </div>
    );
}

function WeaverSkeleton() {
    return (
        <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );
}
