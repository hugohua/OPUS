"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// Step 1: Define Variants using CVA (Styles extracted from JSX)
const themeToggleVariants = cva(
    // Base styles: Structure and transitions
    [
        "relative inline-flex items-center justify-center",
        "rounded-lg border p-2",
        "transition-all duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Light Mode: Clean Slate
        "bg-card/80 border-border text-muted-foreground",
        "hover:bg-secondary hover:text-primary",
        // Dark Mode: Deep Space
        "dark:bg-card/50 dark:border-border/50 dark:backdrop-blur-sm",
        "dark:text-muted-foreground dark:hover:bg-primary dark:hover:text-primary-foreground",
    ],
    {
        variants: {
            size: {
                default: "h-9 w-9",
                sm: "h-8 w-8 p-1.5",
                lg: "h-10 w-10 p-2.5",
            },
        },
        defaultVariants: {
            size: "default",
        },
    }
)

// Step 2: Define Props Interface extending VariantProps
interface ThemeToggleProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof themeToggleVariants> { }

// Step 3: Component using cn() to merge variants + className
export function ThemeToggle({ className, size, ...props }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme()

    return (
        <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(themeToggleVariants({ size }), className)}
            aria-label="Toggle theme"
            {...props}
        >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all duration-300 dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </button>
    )
}
