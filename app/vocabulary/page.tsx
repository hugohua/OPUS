import { prisma } from "@/lib/db";
import {
    VocabularyCard,
    Collocation,
} from "@/components/vocabulary/VocabularyCard";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

export const revalidate = 3600; // Revalidate every hour

// ============================================================================
// CVA Variants (Anti-Class-Soup Pattern)
// ============================================================================

/**
 * Sticky Header with Glassmorphism
 */
const headerVariants = cva([
    "sticky top-0 z-50 border-b backdrop-blur-xl",
    // Light Mode: White Frost
    "border-border bg-background/70 supports-[backdrop-filter]:bg-background/60",
    // Dark Mode: Deep Frost
    "dark:border-border/30 dark:bg-background/80 dark:supports-[backdrop-filter]:bg-background/60",
]);

/**
 * View Toggle Button (Grid/List)
 */
const viewToggleVariants = cva(
    ["px-4 py-1.5 rounded-md text-xs font-semibold transition-colors"],
    {
        variants: {
            active: {
                true: "bg-primary text-primary-foreground shadow-lg shadow-primary/20",
                false: "text-muted-foreground hover:text-foreground",
            },
        },
        defaultVariants: {
            active: false,
        },
    }
);

/**
 * Level Filter Badge
 */
const filterBadgeVariants = cva([
    "flex h-10 items-center justify-center rounded-lg border px-4",
    "text-xs font-semibold uppercase tracking-wider",
    "border-border/50 bg-secondary/50 text-muted-foreground",
    "dark:border-border/30 dark:bg-transparent",
]);

/**
 * Page Background Gradient
 */
const pageBackgroundVariants = cva([
    "fixed inset-0 -z-10 pointer-events-none",
    "bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))]",
    "from-primary/10 via-background to-background",
    "dark:from-primary/20 dark:via-background dark:to-background",
]);

// ============================================================================
// Page Component
// ============================================================================
export default async function VocabularyPage() {
    const words = await prisma.vocab.findMany({
        where: {
            abceed_level: { not: null },
        },
        orderBy: [
            { abceed_level: "desc" }, // Show hardest words first (Level 9+)
            { abceed_rank: "asc" },
        ],
        take: 100, // Limit for performance
        select: {
            id: true,
            word: true,
            abceed_level: true,
            definition_jp: true,
            collocations: true,
        },
    });

    return (
        <main className="min-h-screen w-full bg-background font-sans text-foreground selection:bg-primary/30 selection:text-primary dark:selection:text-primary/80">
            {/* Sticky Header with Glassmorphism */}
            <header className={cn(headerVariants())}>
                <div className="container mx-auto flex h-20 items-center justify-between px-6 lg:px-12">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">
                            Vocabulary Mastery
                        </h1>
                        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span className="inline-block h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                            Abceed Elite Collection ·{" "}
                            <span className="text-primary">{words.length} Words</span>
                        </p>
                    </div>

                    {/* Decorative / Actions */}
                    <div className="hidden items-center gap-4 md:flex">
                        <div className={cn(filterBadgeVariants())}>Level 1-12</div>
                        <div className="flex rounded-lg border border-border bg-secondary p-1 dark:border-border/30 dark:bg-secondary/50">
                            <button className={cn(viewToggleVariants({ active: true }))}>
                                Grid
                            </button>
                            <button className={cn(viewToggleVariants({ active: false }))}>
                                List
                            </button>
                        </div>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Main Content Grid */}
            <div className="container mx-auto px-6 py-12 lg:px-12">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:gap-8">
                    {words.map((word) => (
                        <VocabularyCard
                            key={word.id}
                            word={word.word}
                            abceedLevel={word.abceed_level}
                            definitionJp={word.definition_jp}
                            collocations={word.collocations as unknown as Collocation[]}
                        />
                    ))}
                </div>
            </div>

            {/* Background Decorator */}
            <div className={cn(pageBackgroundVariants())} />
        </main>
    );
}
