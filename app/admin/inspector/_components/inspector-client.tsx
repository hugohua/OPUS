'use client';

import { useState } from 'react';

import { GeneratorStreamView } from './stream-view';
import { ContentSimView } from './content-sim';

// interface InspectorClientProps {} // Removed

export function InspectorClient() {
    const [activeTab, setActiveTab] = useState<'generator' | 'content'>('generator');

    return (
        <div className="flex flex-col h-screen max-h-screen">
            {/* Header / Tabs */}
            <div className="h-14 border-b border-white/10 bg-zinc-900/50 flex items-center px-6 gap-6 sticky top-0 z-50 backdrop-blur-sm">
                <div className="flex items-center gap-2 mr-8">
                    <span className="font-mono font-bold text-violet-400">GOD VIEW</span>
                </div>

                <button
                    onClick={() => setActiveTab('generator')}
                    className={`h-full px-4 text-sm font-medium border-b-2 transition-all ${activeTab === 'generator'
                        ? 'border-violet-500 text-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    生成器调试 (Generator)
                </button>

                <button
                    onClick={() => setActiveTab('content')}
                    className={`h-full px-4 text-sm font-medium border-b-2 transition-all ${activeTab === 'content'
                        ? 'border-violet-500 text-white'
                        : 'border-transparent text-zinc-500 hover:text-zinc-300'
                        }`}
                >
                    内容模拟 (Content Sim)
                </button>
            </div>

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                {activeTab === 'generator' ? (
                    <GeneratorStreamView />
                ) : (
                    <div className="flex-1 flex flex-col bg-black h-full">
                        <ContentSimView />
                    </div>
                )}
            </main>
        </div>
    );
}
