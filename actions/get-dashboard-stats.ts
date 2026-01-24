"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";

export interface DashboardStats {
    syntax: {
        count: number;
        status: "ready" | "warning" | "locked";
    };
    chunking: {
        count: number;
        status: "ready" | "warning" | "locked";
    };
    nuance: {
        count: number;
        status: "ready" | "warning" | "locked";
    };
}

export async function getDashboardStats(): Promise<DashboardStats> {
    try {
        const session = await auth();
        const user = session?.user;

        if (!user || !user.id) {
            // Fallback for demo/unauthenticated state
            return {
                syntax: { count: 0, status: "ready" },
                chunking: { count: 0, status: "locked" },
                nuance: { count: 0, status: "locked" },
            };
        }

        const now = new Date();

        // 1. Calculate Total Pending (Review Due)
        const pendingCount = await db.userProgress.count({
            where: {
                userId: user.id,
                next_review_at: {
                    lte: now,
                },
                status: {
                    in: ["LEARNING", "REVIEW"],
                },
            },
        });

        // 2. Calculate New Words available (for Syntax Mode)
        const newCount = await db.userProgress.count({
            where: {
                userId: user.id,
                status: "NEW"
            }
        })

        // Mock logic for splitting pending/new into modes for now
        // In a real scenario, we might query based on dim_v_score or specific tags
        // For v1.6, we map:
        // Syntax -> Mix of New Cards + Reviews. Status is "ready" if there are any.
        // Chunking -> The "Backlog" or high volume reviews.

        // Logic:
        // If pending > 50, Chunking shows "Warning" with count.

        const syntaxCount = newCount + Math.min(pendingCount, 20); // Cap syntax batch at 20
        const chunkingCount = pendingCount; // Chunking handles the bulk

        return {
            syntax: {
                count: syntaxCount,
                status: syntaxCount > 0 ? "ready" : "ready", // Always ready for drills
            },
            chunking: {
                count: chunkingCount,
                status: chunkingCount > 30 ? "warning" : "ready", // Warn if backlog high
            },
            nuance: {
                count: 0,
                status: "locked", // Feature flag: locked for now
            },
        };
    } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
        return {
            syntax: { count: 0, status: "ready" },
            chunking: { count: 0, status: "locked" },
            nuance: { count: 0, status: "locked" },
        };
    }
}
