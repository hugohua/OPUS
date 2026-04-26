import { beforeEach, describe, expect, it, vi } from "vitest";

const getTTSAudioCoreMock = vi.fn();

vi.mock("@/lib/tts/service", () => ({
    getTTSAudioCore: getTTSAudioCoreMock,
}));

describe("mobile TTS adapter", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns an absolute audio URL for native playback", async () => {
        const { generateMobileTTS } = await import("./tts");

        getTTSAudioCoreMock.mockResolvedValueOnce({
            url: "/audio/audit.wav",
            cached: true,
            hash: "audio-hash",
        });

        const result = await generateMobileTTS(
            {
                text: " audit ",
                voice: "Kai",
                language: "en-US",
                speed: 0.9,
                cacheType: "phrase",
            },
            "https://api.example.com/api/mobile/v1/tts/generate"
        );

        expect(getTTSAudioCoreMock).toHaveBeenCalledWith({
            text: "audit",
            voice: "Kai",
            language: "en-US",
            speed: 0.9,
            cacheType: "phrase",
        });
        expect(result).toEqual({
            url: "/audio/audit.wav",
            audioUrl: "https://api.example.com/audio/audit.wav",
            cached: true,
            hash: "audio-hash",
        });
    });
});
