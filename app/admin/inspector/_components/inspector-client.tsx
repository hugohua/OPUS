'use client';

import { useState } from 'react';

import { GeneratorStreamView } from './stream-view';
import { ContentSimView } from './content-sim';

// interface InspectorClientProps {} // Removed

export function InspectorClient() {
    const [activeTab, setActiveTab] = useState<'generator' | 'content'>('generator');

    return (
        <div className="flex flex-col h-screen max-h-screen bg-background">
            {/* Header / Tabs */}
            <div className="h-14 border-b border-border bg-background/95 flex items-center px-6 gap-6 sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center gap-2 mr-8">
                    <span className="font-mono font-bold text-violet-500">GOD VIEW</span>
                </div>

                <button
                    onClick={() => setActiveTab('generator')}
                    className={cn(
                        "h-full px-4 text-sm font-medium border-b-2 transition-all",
                        activeTab === 'generator'
                            ? "border-violet-500 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    生成器调试 (Generator)
                </button>

                <button
                    onClick={() => setActiveTab('content')}
                    className={cn(
                        "h-full px-4 text-sm font-medium border-b-2 transition-all",
                        activeTab === 'content'
                            ? "border-violet-500 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                >
                    内容模拟 (Content Sim)
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                {activeTab === 'generator' ? (
                    <GeneratorStreamView />
                ) : (
                    <div className="flex-1 flex flex-col bg-background h-full">
                        <ContentSimView />
                    </div>
                )}
            </main>
        </div>
    );
}

import { cn } from '@/lib/utils';
