"use client";

import Link from "next/link";
import { User } from "next-auth";

interface UserProfileButtonProps {
    user?: User;
}

export function UserProfileButton({ user }: UserProfileButtonProps) {
    const initials = user?.name
        ? user.name.charAt(0).toUpperCase()
        : user?.email
            ? user.email.charAt(0).toUpperCase()
            : "U";

    return (
        <Link href="/dashboard/profile">
            <button className="group flex items-center gap-3 pl-3 pr-1 py-1 rounded-full bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/15 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] hover:shadow-md hover:scale-[1.02] active:scale-95 transition-all duration-300">

                <div className="text-right hidden sm:block">
                    {/* 暂时硬编码 Level 和 Title，后续可接入真实数据 */}
                    <div className="text-[10px] font-bold font-mono text-zinc-800 dark:text-zinc-200 group-hover:text-violet-500 transition-colors">
                        Lvl. 12
                    </div>
                    <div className="text-[8px] text-zinc-400 uppercase tracking-wider">
                        Syntax Architect
                    </div>
                </div>

                <div className="relative">
                    {/* Gradient Ring / Blur Effect */}
                    <div className="absolute -inset-[2px] bg-gradient-to-br from-amber-300 to-violet-600 rounded-full opacity-70 group-hover:opacity-100 transition-opacity blur-[1px]"></div>

                    {/* Avatar Container */}
                    <div className="relative w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center border-2 border-white dark:border-zinc-950 overflow-hidden">
                        {user?.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={user.image}
                                alt={user.name || "User"}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className="font-serif text-sm font-bold text-white">
                                {initials}
                            </span>
                        )}
                    </div>

                    {/* Status Dot (Optional - can signify notification or online status) */}
                    <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-zinc-900 rounded-full z-10"></div>
                </div>
            </button>
        </Link>
    );
}
