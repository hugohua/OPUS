import { getAudioSession } from "@/actions/audio-session";
import { getReviewCards } from "@/app/dashboard/cards/actions";
import { type WordAsset } from "@/types/word";

export type MobileTrainingEntryAvailability = {
    key: string;
    title: string;
    available: boolean;
    reason?: string;
    count: number;
};

export async function getMobileAudioAvailability(userId: string) {
    const result = await getAudioSession(userId);
    const items = result.status === "success" ? result.data?.items ?? [] : [];

    return {
        key: "audio",
        title: "听力训练",
        available: items.length > 0,
        reason: items.length > 0 ? undefined : "暂无到期听力复习，稍后再来。",
        count: items.length,
        items,
    };
}

export async function getMobileReviewCards(limit = 20, userId: string): Promise<WordAsset[]> {
    return getReviewCards(limit, [], userId);
}
