import React from "react";

export function GridBackground({ children }: { children?: React.ReactNode }) {
    return (
        <div className="h-screen w-full dark:bg-background bg-white dark:bg-grid-white/[0.2] bg-grid-black/[0.2] relative flex items-center justify-center">
            {/* Radial gradient for the container to give a faded look */}
            <div className="absolute pointer-events-none inset-0 flex items-center justify-center dark:bg-background bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>

            {/* Content */}
            <div className="relative z-20">
                {children}
            </div>
        </div>
    );
}
