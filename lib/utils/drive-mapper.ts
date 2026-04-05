import { DriveItem, DriveMode, DRIVE_VOICE_CONFIG, DRIVE_VOICE_SPEED_PRESETS } from '@/lib/constants/drive';

export function mapToDriveItem(v: any, mode: DriveMode, context: 'warmup' | 'review'): DriveItem {
    return {
        id: v.id.toString(),
        text: v.word, // 恢复UI绑定的主词汇大图
        trans: v.commonExample || v.definition_cn || '暂无翻译', // 恢复UI绑定的副标题
        phonetic: v.phoneticUs || v.phoneticUk || '',
        word: v.word,
        ttsPhrase: v.commonExample || '', // 用于 TTS
        pos: v.partOfSpeech || 'n.',
        meaning: v.definition_cn || '',
        scenarios: v.scenarios,
        stability: undefined,
        mode: mode,
        voice: context === 'warmup' ? DRIVE_VOICE_CONFIG.WARMUP : DRIVE_VOICE_CONFIG.QUIZ_QUESTION,
        speed: DRIVE_VOICE_SPEED_PRESETS[context === 'warmup' ? DRIVE_VOICE_CONFIG.WARMUP : DRIVE_VOICE_CONFIG.QUIZ_QUESTION] || 1.0,
    };
}
