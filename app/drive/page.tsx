import { generateDrivePlaylist } from '@/actions/drive';
import { DriveLayout } from './_components/DriveLayout';
import { DriveTrack } from '@/lib/constants/drive';

// ✅ 禁用页面缓存，确保每次访问都根据最新 FSRS 状态生成播放列表
export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ track?: string }>;
}

export default async function DrivePage({ searchParams }: PageProps) {
    const params = await searchParams;

    // 解析 track 参数，默认 VISUAL
    const track = (params.track as DriveTrack) || 'VISUAL';

    // 获取初始播放列表
    const response = await generateDrivePlaylist({ track, pageSize: 15 });

    return (
        <DriveLayout
            initialPlaylist={response.items}
            initialCursor={response.nextCursor}
            initialHasMore={response.hasMore}
            track={track}
        />
    );
}
