/**
 * 训练矩阵动态状态共享核心
 * 功能：
 *   基于用户 Multi-Track FSRS 状态为训练矩阵填充动态待练状态。
 *   Web/H5/iOS 只能消费这里的结果，不在 adapter 中复制训练规则。
 */

import { db } from "@/lib/db";
import { resolveSelectionTrack, type SessionTrack } from "@/lib/backend-core/session/policy";
import { buildNotMasteredVocabWhere } from "@/lib/vocab-state/filters";
import type { SessionMode, SingleScenarioMode } from "@/types/briefing";
import { buildTrainingMatrix, type TrainingMatrix, type TrainingMatrixEntry } from "./matrix";

type ProgressForStatus = {
    id: string;
};

const TRAINING_MODES = new Set<string>([
    "SYNTAX",
    "PHRASE",
    "BLITZ",
    "AUDIO",
    "CHUNKING",
    "CONTEXT",
    "NUANCE",
]);

function isTrainingScenarioMode(value: string): value is SingleScenarioMode {
    return TRAINING_MODES.has(value);
}

async function getEligibleProgressForTrack(
    userId: string,
    track: SessionTrack,
    now: Date
): Promise<ProgressForStatus[]> {
    return db.userProgress.findMany({
        where: {
            userId,
            track,
            OR: [
                { status: "NEW" },
                { status: { in: ["LEARNING", "REVIEW"] }, next_review_at: { lte: now } },
            ],
            vocab: buildNotMasteredVocabWhere(userId),
        },
        select: {
            id: true,
        },
    });
}

function withDynamicStatus(entry: TrainingMatrixEntry, countsByTrack: Record<SessionTrack, number>): TrainingMatrixEntry {
    if (entry.destination.kind !== "training" || !isTrainingScenarioMode(entry.destination.value)) {
        return entry;
    }

    const track = resolveSelectionTrack(entry.destination.value);
    const count = countsByTrack[track] ?? 0;
    return {
        ...entry,
        availability: count > 0 ? "ready" : "empty",
        count,
        statusLabel: count > 0 ? `可练: ${count}` : "暂无到期",
    };
}

export async function buildTrainingMatrixForUser(userId: string, now = new Date()): Promise<TrainingMatrix> {
    const shell = buildTrainingMatrix();
    const modes = shell.sections
        .flatMap((section) => section.entries)
        .map((entry) => entry.destination)
        .filter((destination): destination is { kind: "training"; value: SessionMode } => destination.kind === "training")
        .map((destination) => destination.value)
        .filter(isTrainingScenarioMode);

    const tracks = Array.from(new Set(modes.map((mode) => resolveSelectionTrack(mode))));
    const trackResults = await Promise.all(
        tracks.map(async (track) => {
            const progressItems = await getEligibleProgressForTrack(userId, track, now);
            return [track, progressItems.length] as const;
        })
    );

    const countsByTrack = Object.fromEntries(trackResults) as Record<SessionTrack, number>;

    return {
        sections: shell.sections.map((section) => ({
            ...section,
            entries: section.entries.map((entry) => withDynamicStatus(entry, countsByTrack)),
        })),
    };
}
