"use client";

import { motion } from "framer-motion";
import { Sparkles, Home, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingDock() {
    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[320px]">
            <div className="relative flex items-center justify-between px-6 py-3 mx-4 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl shadow-zinc-200/50 dark:shadow-black/50">

                {/* Left Action: Home */}
                <button className="p-2 text-primary hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                    <Home className="w-6 h-6 stroke-[1.5px]" />
                </button>

                {/* Center Action: Magic Paste (Floating) */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-6">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        whileHover={{ scale: 1.05 }}
                        className="flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg shadow-violet-500/30 border-4 border-zinc-50 dark:border-zinc-950"
                    >
                        <Sparkles className="w-8 h-8 stroke-[1.5px]" />
                    </motion.button>
                </div>

                {/* Right Actions: Library */}
                <div className="flex gap-4">
                    {/* Ghost spacer to balance the center button */}
                    <div className="w-8" />

                    <button className="p-2 text-muted-foreground hover:text-primary hover:bg-zinc-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                        <Layers className="w-6 h-6 stroke-[1.5px]" />
                    </button>
                </div>
            </div>
        </div>
    );
}
