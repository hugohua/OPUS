import { getNextBriefing } from '@/actions/game-loop';
import { InboxClient } from '@/components/briefing/inbox-client';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
    // Phase 2 MVP: Always start with count 0 (session based)
    // Phase 3: Will fetch actual progress from DB
    const initialBriefing = await getNextBriefing(0);

    return <InboxClient initialBriefing={initialBriefing} />;
}
