import { VocabularyProvider } from "@/components/vocabulary/vocabulary-provider";
import { VocabularyList } from "@/components/vocabulary/vocabulary-list";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "词库 | Opus",
    description: "FSRS 记忆管理中心",
};

import { getUserAllTags } from "@/actions/vocab-actions";
import { FloatingDockClient } from "@/components/dashboard/floating-dock-client";

export default async function VocabularyPage() {
    const initialTags = await getUserAllTags();
    return (
        <div className="min-h-screen bg-background font-sans flex justify-center selection:bg-primary/20">
            <div className="w-full max-w-md bg-background min-h-[100dvh] shadow-2xl ring-1 ring-border/5 relative flex flex-col">
                <VocabularyProvider>
                    <VocabularyList initialTags={initialTags} />
                    <FloatingDockClient />
                </VocabularyProvider>
            </div>
        </div>
    );
}
