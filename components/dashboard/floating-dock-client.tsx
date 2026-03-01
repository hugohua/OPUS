'use client';

import { useEffect, useState } from "react";
import { getDashboardStats } from "@/actions/get-dashboard-stats";
import { FloatingDock } from "@/components/dashboard/floating-dock";

export function FloatingDockClient() {
    const [hasDue, setHasDue] = useState(false);

    useEffect(() => {
        let mounted = true;
        getDashboardStats().then(stats => {
            if (mounted && stats?.fsrs?.due > 0) {
                setHasDue(true);
            }
        }).catch(console.error);

        return () => { mounted = false; };
    }, []);

    return <FloatingDock hasDue={hasDue} />;
}
