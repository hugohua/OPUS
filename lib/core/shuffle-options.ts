import { BriefingPayload } from "@/types/briefing";

/**
 * Shuffles the options array in all interaction segments of a BriefingPayload.
 * Ensures the correct answer doesn't predictably appear in the same position (e.g., always A).
 */
export function shuffleBriefingOptions(payload: BriefingPayload): BriefingPayload {
    if (!payload?.segments) return payload;

    const newSegments = payload.segments.map((segment) => {
        if (segment.type === 'interaction' && segment.task && Array.isArray(segment.task.options)) {
            // Clone the options array
            const options = [...segment.task.options];

            // Fisher-Yates shuffle
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }

            // Optional: If options are objects with strictly sequential IDs like A, B, C, D, 
            // recalculate their IDs to maintain the visual A/B/C/D order 
            // regardless of their new positions.
            const updatedOptions = options.map((opt, index) => {
                const letterId = String.fromCharCode(65 + index); // 65 is 'A'

                if (typeof opt === 'string') {
                    // For string[] options, returning the string is enough
                    return opt;
                } else if (typeof opt === 'object' && opt !== null) {
                    // For object arrays like { id: 'A', text: '...', is_correct: true }
                    return { ...opt, id: letterId };
                }
                return opt;
            });

            return {
                ...segment,
                task: {
                    ...segment.task,
                    options: updatedOptions
                }
            };
        }
        return segment; // Non-interaction segments remain unchanged
    });

    return {
        ...payload,
        segments: newSegments
    };
}
