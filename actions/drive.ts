'use server';

/**
 * Drive 播放列表 Server Action (V3)
 *
 * Web 入口只负责鉴权与 action 形态；playlist 生成逻辑在
 * `lib/drive/playlist.ts` 中与移动端 route 共用。
 */

import { auth } from '@/auth';
import { generateDrivePlaylistForUser } from '@/lib/drive/playlist';
import {
    type DrivePlaylistOptions,
    type DrivePlaylistResponse,
} from '@/lib/constants/drive';

export async function generateDrivePlaylist(
    options: DrivePlaylistOptions = {}
): Promise<DrivePlaylistResponse> {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error('Unauthorized');
    }

    return generateDrivePlaylistForUser(session.user.id, options);
}
