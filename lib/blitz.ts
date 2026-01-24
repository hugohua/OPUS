
export type BlitzSegment = {
    text: string;
    type: 'static' | 'masked' | 'target-first-char';
};

/**
 * Masking Engine for Phrase Blitz
 * 规则:
 * 1. 找到 target 在 phrase 中的位置 (Case Insensitive)
 * 2. 仅 mask 第一个匹配项
 * 3. 目标词保留首字母 (First Char Ghosting)
 * 4. 其余部分遮盖 (UI 渲染时可以用下划线或 blur)
 */
export function maskPhrase(phrase: string, target: string): BlitzSegment[] {
    if (!phrase || !target) return [{ text: phrase, type: 'static' }];

    const lowerPhrase = phrase.toLowerCase();
    const lowerTarget = target.toLowerCase();
    const index = lowerPhrase.indexOf(lowerTarget);

    // Target not found
    if (index === -1) {
        return [{ text: phrase, type: 'static' }];
    }

    // Segments
    const segments: BlitzSegment[] = [];

    // 1. Prefix (Static)
    if (index > 0) {
        segments.push({
            text: phrase.substring(0, index),
            type: 'static',
        });
    }

    // 2. Target (First Char + Masked)
    const actualTarget = phrase.substring(index, index + target.length);
    if (actualTarget.length > 0) {
        // First char
        segments.push({
            text: actualTarget[0],
            type: 'target-first-char',
        });

        // Remainder
        if (actualTarget.length > 1) {
            segments.push({
                text: actualTarget.substring(1),
                type: 'masked',
            });
        }
    }

    // 3. Suffix (Static)
    if (index + target.length < phrase.length) {
        segments.push({
            text: phrase.substring(index + target.length),
            type: 'static',
        });
    }

    return segments;
}
