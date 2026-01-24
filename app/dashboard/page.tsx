import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DailyDrills } from "@/components/dashboard/daily-drills";
import { ContextEngine } from "@/components/dashboard/context-engine";
import { FloatingDock } from "@/components/dashboard/floating-dock";
import { getDashboardStats } from "@/actions/get-dashboard-stats";

export default async function DashboardPage() {
    const stats = await getDashboardStats();

    return (
        <div className="relative min-h-screen bg-zinc-50 dark:bg-zinc-950 pb-32">
            {/* 1. Ambient Light */}
            <div className="fixed top-0 left-0 right-0 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-50/50 via-transparent to-transparent dark:from-indigo-950/30 dark:via-zinc-950/0 dark:to-transparent pointer-events-none" />

            {/* 1. Header Section */}
            <DashboardHeader />

            {/* 2. Daily Drills (Horizontal Scroll) */}
            <DailyDrills stats={stats} />

            {/* 3. Context Engine (Vertical Stream) */}
            <ContextEngine />

            {/* 4. Floating Navigation (Thumb Zone) */}
            <FloatingDock />
        </div>
    );
}
