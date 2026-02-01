'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Command } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SidebarContextValue {
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined);

export function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
    defaultExpanded?: boolean;
}

export function AdminSidebar({ className, children, defaultExpanded = true, ...props }: SidebarProps) {
    const [expanded, setExpanded] = React.useState(defaultExpanded);

    return (
        <SidebarContext.Provider value={{ expanded, setExpanded }}>
            <aside
                data-state={expanded ? "expanded" : "collapsed"}
                className={cn(
                    "group relative border-r border-border bg-muted/30 flex flex-col transition-all duration-300 ease-in-out",
                    expanded ? "w-64" : "w-16",
                    className
                )}
                {...props}
            >
                {/* Toggle Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -right-3 top-6 h-6 w-6 rounded-full border border-border bg-muted text-muted-foreground hover:text-foreground shadow-md z-50"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? <ChevronLeft className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </Button>

                {children}
            </aside>
        </SidebarContext.Provider>
    );
}

export function SidebarHeader({ children }: { children: React.ReactNode }) {
    const { expanded } = useSidebar();
    return (
        <div className={cn(
            "h-16 flex items-center border-b border-white/5 overflow-hidden whitespace-nowrap",
            expanded ? "px-6" : "justify-center px-2"
        )}>
            {children}
        </div>
    );
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
    return (
        <nav className="flex-1 py-6 space-y-2 px-2 overflow-y-auto overflow-x-hidden">
            {children}
        </nav>
    );
}

export function SidebarFooter({ children }: { children: React.ReactNode }) {
    const { expanded } = useSidebar();
    return (
        <div className={cn(
            "border-t border-white/5 overflow-hidden whitespace-nowrap",
            expanded ? "p-4" : "p-2 py-4 flex flex-col items-center"
        )}>
            {children}
        </div>
    );
}

interface SidebarItemProps {
    icon: React.ReactNode;
    label: string;
    active?: boolean;
    onClick?: () => void;
    href?: string;
}

export function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
    const { expanded } = useSidebar();

    return (
        <button
            onClick={onClick}
            title={!expanded ? label : undefined}
            className={cn(
                "w-full flex items-center gap-3 rounded-lg transition-all group relative",
                expanded ? "px-3 py-2" : "justify-center p-2",
                active
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
        >
            <div className="shrink-0">
                {icon}
            </div>

            <span className={cn(
                "text-xs font-bold uppercase tracking-wider transition-all duration-300 overflow-hidden",
                expanded ? "opacity-100 max-w-[200px]" : "opacity-0 max-w-0 hidden"
            )}>
                {label}
            </span>

            {!expanded && active && (
                <div className="absolute right-1 w-1.5 h-1.5 rounded-full bg-violet-400" />
            )}
        </button>
    );
}
