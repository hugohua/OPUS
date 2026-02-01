import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DailyBlitzCard } from "@/components/dashboard/daily-blitz-card";
import { SkillGym } from "@/components/dashboard/skill-gym";
import { ContextEngine } from "@/components/dashboard/context-engine";
import { FloatingDock } from "@/components/dashboard/floating-dock";
import { getDashboardStats } from "@/actions/get-dashboard-stats";
import { auth } from "@/auth";
import { FsrsHud } from "@/components/dashboard/fsrs-hud";
import { FlashcardSection } from "@/components/dashboard/flashcard-section";

export default async function DashboardPage() {
    // We might keep fetching stats for future dynamic updates, though currently cards are static shell.
    const stats = await getDashboardStats();
    const session = await auth();

    return (
        <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-32 flex flex-col gap-8 relative overflow-x-hidden selection:bg-violet-500/30">
            {/* Ambient Light (Warm Sunlight) */}
            <div className="fixed top-0 left-0 right-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-50/50 via-transparent to-transparent dark:from-orange-400/10 dark:via-zinc-950/0 dark:to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-8 max-w-md mx-auto w-full">
                {/* 1. Header */}
                <DashboardHeader user={session?.user} />

                {/* 1.5 FSRS HUD */}
                <FsrsHud stats={stats.fsrs} />

                {/* 2. Scrollable Body */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-8 no-scrollbar">
                    {/* Hero: Daily Blitz */}
                    <DailyBlitzCard />

                    {/* New Module: Flashcards */}
                    <FlashcardSection />

                    {/* Grid: Skill Gym */}
                    <SkillGym />

                    {/* Stream: Context Engine (Restored) */}
                    <ContextEngine />
                </div>
            </div>

            {/* 3. Floating Dock (Restored) */}
            <FloatingDock hasDue={stats.fsrs.due > 0} />
        </main>
    );
}
