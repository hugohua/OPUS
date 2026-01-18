import { cn } from "@/lib/utils";
import { Play, CheckCircle, BookOpen } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

// Shadcn UI Components
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================
export interface Collocation {
    text: string;
    trans: string;
    source: string;
    weight: number;
}

// ============================================================================
// Extended CVA Variants (For custom styling on top of Shadcn)
// ============================================================================

/**
 * Card Accent Variants - Extends Shadcn Card with hover effects
 * Restores original design: Glass effect + Lift + Glow
 */
const cardAccentVariants = cva(
    [
        // Reset Shadcn defaults for our custom design
        "group overflow-hidden",
        "transition-all duration-300 ease-out",
        // Light Mode: Crisp white card
        "bg-white shadow-sm",
        // Dark Mode: Glass effect (restore original)
        "dark:bg-slate-900/50 dark:border-white/10 dark:backdrop-blur-md",
        // Hover: Lift Effect (restore original)
        "hover:-translate-y-1",
    ],
    {
        variants: {
            accent: {
                default: [
                    // Light hover
                    "hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)]",
                    "hover:border-indigo-500/30",
                    // Dark hover
                    "dark:hover:border-indigo-500/30",
                    "dark:hover:shadow-[0_10px_40px_-10px_rgba(99,102,241,0.2)]",
                ],
                gold: [
                    // Light hover
                    "hover:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.1)]",
                    "hover:border-amber-500/30",
                    // Dark hover
                    "dark:hover:border-amber-500/30",
                    "dark:hover:shadow-[0_10px_40px_-10px_rgba(245,158,11,0.2)]",
                ],
            },
        },
        defaultVariants: {
            accent: "default",
        },
    }
);

/**
 * Level Badge Variants - Custom styling for levels
 */
const levelBadgeVariants = cva(
    ["rounded-lg text-[11px] font-bold uppercase tracking-wider"],
    {
        variants: {
            level: {
                default: [
                    "border-indigo-200 bg-indigo-50 text-indigo-700",
                    "dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
                ],
                gold: [
                    "border-amber-200 bg-amber-50 text-amber-700",
                    "dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
                ],
            },
        },
        defaultVariants: {
            level: "default",
        },
    }
);

/**
 * Phrase Section Variants - Restore original hover effects
 */
const phraseSectionVariants = cva([
    "relative overflow-hidden rounded-lg border p-4 transition-colors",
    // Light Mode
    "border-slate-100 bg-slate-50",
    "group-hover:border-indigo-100 group-hover:bg-indigo-50/50",
    // Dark Mode
    "dark:border-white/5 dark:bg-slate-950/30",
    "dark:group-hover:border-indigo-500/20 dark:group-hover:bg-indigo-500/5",
]);

// ============================================================================
// Component Props
// ============================================================================
interface VocabularyCardProps extends VariantProps<typeof cardAccentVariants> {
    word: string;
    abceedLevel: number | null;
    definitionJp: string | null;
    collocations: Collocation[];
    className?: string;
}

// ============================================================================
// Component
// ============================================================================
export function VocabularyCard({
    word,
    abceedLevel,
    definitionJp,
    collocations,
    className,
}: VocabularyCardProps) {
    // 1. Determine "Golden Phrase"
    const goldenPhrase =
        collocations.find((c) => c.source === "abceed") || collocations[0];

    // 2. High-Level styling logic (Level 9+ gets special gold treatment)
    const isHighLevel = (abceedLevel || 0) >= 9;
    const accentVariant = isHighLevel ? "gold" : "default";
    const levelVariant = isHighLevel ? "gold" : "default";

    return (
        <Card className={cn(cardAccentVariants({ accent: accentVariant }), className)}>
            {/* Header Section - Custom padding to match original */}
            <CardHeader className="flex flex-row items-start justify-between p-5 pb-2 space-y-0">
                <div className="space-y-2">
                    <div className="flex items-baseline gap-3">
                        <h3 className="font-sans text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50 decoration-indigo-500/30 decoration-2 underline-offset-4 group-hover:underline">
                            {word}
                        </h3>
                    </div>
                    <Badge
                        variant="outline"
                        className={cn(levelBadgeVariants({ level: levelVariant }))}
                    >
                        Level {abceedLevel || "?"}
                    </Badge>
                </div>

                {/* Play Button - Restore original circular style */}
                <Button
                    variant="secondary"
                    size="icon"
                    className={cn(
                        "rounded-full",
                        "bg-slate-100 text-slate-400 hover:bg-indigo-600 hover:text-white",
                        "dark:bg-slate-800/50 dark:text-slate-400 dark:hover:bg-indigo-500 dark:hover:text-white"
                    )}
                    aria-label="Play audio"
                >
                    <Play className="h-4 w-4 fill-current" />
                </Button>
            </CardHeader>

            {/* Body Section - Restore original padding */}
            <CardContent className="flex-1 px-5 py-4 space-y-4">
                {/* Japanese Definition */}
                <div className="flex items-start gap-2">
                    <BookOpen className="mt-1 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-600" />
                    <p className="text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300">
                        {definitionJp || "定义暂无"}
                    </p>
                </div>

                {/* Golden Phrase - Restore original hover effects */}
                {goldenPhrase && (
                    <div className={cn(phraseSectionVariants())}>
                        <div className="mb-1 text-sm font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-indigo-100 dark:group-hover:text-indigo-300">
                            "{goldenPhrase.text}"
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-500 group-hover:text-indigo-400/80 dark:group-hover:text-indigo-200/60">
                            {goldenPhrase.trans}
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Footer / Actions - Restore original styling */}
            <CardFooter
                className={cn(
                    "flex items-center justify-between px-5 py-3",
                    "border-t border-slate-100 bg-slate-50/50",
                    "dark:border-white/5 dark:bg-slate-950/30"
                )}
            >
                <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-600">
                    Abceed Rank #{collocations.length > 0 ? "Top" : "N/A"}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-2 text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-500 dark:hover:text-emerald-400"
                >
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Mastered</span>
                </Button>
            </CardFooter>
        </Card>
    );
}
