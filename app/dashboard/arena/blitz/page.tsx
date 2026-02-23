import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SessionRunner } from "@/components/session/session-runner";
import { getUserSettings } from "@/actions/update-user-settings";
import { UserSettingsProvider } from "@/components/providers/user-settings-provider";

/**
 * Arena Part 5 答题页 (Server Component)
 * 安全策略：使用服务端 auth() 而非 useSession，防止 userId 被客户端篡改
 * 
 * Quick Drill: 当 URL 含 ?node=<grammarNodeId> 时，进入靶向语法训练模式
 */
export default async function ArenaPart5Page({
    searchParams,
}: {
    searchParams: Promise<{ node?: string }>;
}) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/login");
    }

    const settings = await getUserSettings();
    const params = await searchParams;
    const grammarNodeId = params.node;

    return (
        <UserSettingsProvider settings={settings}>
            <SessionRunner
                userId={session.user.id}
                mode="ARENA_PART5"
                grammarNodeId={grammarNodeId}
            />
        </UserSettingsProvider>
    );
}
