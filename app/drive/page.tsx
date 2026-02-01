import { generateDrivePlaylist } from '@/actions/drive';
import { DriveLayout } from './_components/DriveLayout';

export default async function DrivePage() {
    const playlist = await generateDrivePlaylist();

    return (
        <DriveLayout initialPlaylist={playlist} />
    );
}
