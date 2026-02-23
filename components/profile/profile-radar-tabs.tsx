"use client";

import { Activity, Grid } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiagnosticRadar } from "@/components/arena/diagnostic-radar";
import { GrammarRadar } from "@/components/arena/grammar-radar";

export function ProfileRadarTabs({ userId }: { userId?: string }) {
    return (
        <Tabs defaultValue="diagnostic" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="diagnostic" className="text-xs">
                    <Activity className="w-3.5 h-3.5 mr-2" />
                    综合题型
                </TabsTrigger>
                <TabsTrigger value="grammar" className="text-xs">
                    <Grid className="w-3.5 h-3.5 mr-2" />
                    专精语法
                </TabsTrigger>
            </TabsList>
            <TabsContent value="diagnostic" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <DiagnosticRadar userId={userId} />
            </TabsContent>
            <TabsContent value="grammar" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <GrammarRadar />
            </TabsContent>
        </Tabs>
    );
}
