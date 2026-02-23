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
            <button className="group flex items-center justify-center rounded-full active:scale-95 transition-all duration-300">

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
