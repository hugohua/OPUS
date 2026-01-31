import { VocabularyProvider } from "@/components/vocabulary/vocabulary-provider";
import { VocabularyList } from "@/components/vocabulary/vocabulary-list";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Vocabulary Inventory | Opus",
    description: "FSRS Memory Command Center",
};

export default function VocabularyPage() {
    return (
        <VocabularyProvider>
            <VocabularyList />
        </VocabularyProvider>
    );
}
