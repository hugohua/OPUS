import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const authCardVariants = cva(
    "w-full max-w-sm overflow-hidden rounded-xl border transition-all duration-300",
    {
        variants: {
            intent: {
                default: "bg-card text-card-foreground shadow-sm",
                glass: "bg-card/50 backdrop-blur-md border-border shadow-2xl dark:shadow-[0_0_40px_rgba(0,0,0,0.5)]",
            },
        },
        defaultVariants: {
            intent: "glass",
        },
    }
);

interface AuthCardProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof authCardVariants> {
    title?: string;
    description?: string;
}

export function AuthCard({
    className,
    intent,
    title = "Opus.",
    description,
    children,
    ...props
}: AuthCardProps) {
    return (
        <div className={cn(authCardVariants({ intent }), className)} {...props}>
            <div className="flex flex-col space-y-1.5 p-8 pb-4 text-center">
                <h1 className="text-3xl font-black tracking-tighter text-foreground font-serif">
                    {title}
                </h1>
                {description && (
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70 font-mono">
                        {description}
                    </p>
                )}
            </div>
            <div className="p-8 pt-0">
                {children}
            </div>
        </div>
    );
}
