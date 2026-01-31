import { GlobalAdminSidebar } from './_components/global-sidebar';

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-violet-500/30">
            {/* Unified Sidebar */}
            <GlobalAdminSidebar />

            {/* Main Content Area */}
            <main className="flex-1 relative flex flex-col overflow-y-auto bg-black/95">
                {children}
            </main>
        </div>
    );
}
