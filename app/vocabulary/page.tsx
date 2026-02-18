import { VocabularyProvider } from "@/components/vocabulary/vocabulary-provider";
import { VocabularyList } from "@/components/vocabulary/vocabulary-list";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "词库 | Opus",
    description: "FSRS 记忆管理中心",
};

export default function VocabularyPage() {
    return (
        <VocabularyProvider>
            <VocabularyList />
        </VocabularyProvider>
    );
}
