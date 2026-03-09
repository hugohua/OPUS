/**
 * Drive 页面 (V3)
 * 
 * 听力模式入口：一次性加载基于 mode + batchSize 的播放列表，循环播放
 */

import { generateDrivePlaylist } from '@/actions/drive';
import { DriveLayout } from './_components/DriveLayout';
import { DriveTrack } from '@/lib/constants/drive';
import { ReviewModeId, BatchSize, DEFAULT_BATCH_SIZE } from '@/lib/constants/review-modes';

// ✅ 禁用页面缓存，确保每次访问都根据最新 FSRS 状态生成播放列表
export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ track?: string; mode?: string; batch?: string }>;
}

export default async function DrivePage({ searchParams }: PageProps) {
    const params = await searchParams;

    // 解析参数
    const track = (params.track as DriveTrack) || 'VISUAL';
    const mode = (params.mode as ReviewModeId) || 'SANDWICH';
    const batchSize = (params.batch ? parseInt(params.batch) : DEFAULT_BATCH_SIZE) as BatchSize;

    // 获取初始播放列表
    const response = await generateDrivePlaylist({ track, mode, batchSize });

    return (
        <DriveLayout
            initialPlaylist={response.items}
            track={track}
            initialMode={mode}
            initialBatchSize={batchSize}
        />
    );
}
