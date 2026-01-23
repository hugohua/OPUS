'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Briefcase, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DashboardNav() {
    const pathname = usePathname();

    const tabs = [
        {
            name: 'Simulate',
            href: '/dashboard/simulate',
            icon: Briefcase,
        },
        {
            name: 'Cards',
            href: '/dashboard/cards',
            icon: Layers,
        },
    ];

    return (
        <nav className="sticky bottom-0 z-50 w-full h-16 border-t bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/60">
            <div className="grid h-full grid-cols-2">
                {tabs.map((tab) => {
                    const isActive = pathname?.startsWith(tab.href);
                    const Icon = tab.icon;

                    return (
                        <Link key={tab.href} href={tab.href} className="flex flex-col items-center justify-center">
                            <Button
                                variant="ghost"
                                className={cn(
                                    "h-full w-full rounded-none flex flex-col gap-1 hover:bg-transparent",
                                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className="h-6 w-6 stroke-[1.5px]" />
                                <span className="text-[10px] font-medium uppercase tracking-wider">{tab.name}</span>
                            </Button>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
