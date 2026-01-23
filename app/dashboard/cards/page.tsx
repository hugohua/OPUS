import { CardStack } from '@/components/drill/card-stack';
import { WordAsset } from '@/types/word';

// Mock Data for Phase 1.4 MVP
const MOCK_CARDS: WordAsset[] = [
    {
        id: 101,
        word: 'facilitate',
        phonetic: '/fəˈsɪl.ɪ.teɪt/',
        meaning: 'To make something possible or easier',
        word_family: { v: 'facilitate', n: 'facilitation', adj: 'facilitative' },
        collocations: [
            { text: 'facilitate a meeting', translation: '主持/促进会议' },
            { text: 'facilitate growth', translation: '促进增长' }
        ]
    },
    {
        id: 102,
        word: 'implementation',
        phonetic: '/ˌɪm.plɪ.menˈteɪ.ʃən/',
        meaning: 'The act of putting a plan into action',
        word_family: { n: 'implementation', v: 'implement' },
        collocations: [
            { text: 'successful implementation', translation: '成功实施' },
            { text: 'project implementation', translation: '项目实施' }
        ]
    },
    {
        id: 103,
        word: 'deadline',
        phonetic: '/ˈded.laɪn/',
        meaning: 'A time or day by which something must be done',
        word_family: { n: 'deadline' },
        collocations: [
            { text: 'meet the deadline', translation: '赶上截止日期' },
            { text: 'miss the deadline', translation: '错过截止日期' },
            { text: 'tight deadline', translation: '紧迫的期限' }
        ]
    }
];

export default function CardsPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 px-2">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Review Deck</h1>
                    <p className="text-sm text-muted-foreground">Swipe left to review later.</p>
                </div>
                <div className="text-sm font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                    {MOCK_CARDS.length} Cards
                </div>
            </div>

            {/* Stack Container */}
            <div className="flex-1">
                <CardStack items={MOCK_CARDS} />
            </div>
        </div>
    );
}
