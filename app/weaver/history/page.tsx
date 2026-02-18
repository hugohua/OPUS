
import React from "react";
import { WeaverArchives } from "@/components/weaver/WeaverArchives";
import { getWeaverHistory, getWeaverContexts } from "@/actions/weaver-actions";

interface PageProps {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function WeaverHistoryPage({ searchParams }: PageProps) {
    const params = await searchParams;

    // Parse filters
    const filterContext = typeof params.context === 'string' ? params.context : undefined;
    const filterStatus = params.status === 'new' || params.status === 'archived' ? params.status : undefined;

    // Parallel fetch
    const [history, contexts] = await Promise.all([
        getWeaverHistory(filterContext, filterStatus),
        getWeaverContexts()
    ]);

    // transform history to match interface
    const articles = history.map(h => ({
        id: h.id,
        title: h.title,
        createdAt: h.createdAt,
        scenario: h.scenario,
        vocabPreview: h.vocabPreview
    }));

    return (
        <div className="min-h-screen bg-background">
            <WeaverArchives articles={articles} contexts={contexts} />
        </div>
    );
}
