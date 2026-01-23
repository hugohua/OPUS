import { DashboardNav } from '@/components/layout/dashboard-nav';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    return (
        <div className="min-h-screen bg-background font-sans flex justify-center selection:bg-primary/20">
            {/* Mobile First Container - "The Device" */}
            <div className="w-full max-w-md bg-background min-h-screen shadow-2xl ring-1 ring-border/5 relative flex flex-col">

                {/* Main Workspace */}
                <main className="flex-1 w-full relative z-0">
                    {children}
                </main>

                {/* Interaction Layer */}
                <DashboardNav />

            </div>
        </div>
    );
}
