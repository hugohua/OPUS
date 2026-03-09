import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // 01 / Primary Actions (Mechanical Press) - Neutral
        default:
          "bg-slate-900 text-white shadow-[0_3px_0_#0f172a] hover:bg-slate-800 active:translate-y-[3px] active:shadow-none dark:bg-zinc-100 dark:text-zinc-900 dark:shadow-[0_3px_0_#d4d4d8] dark:hover:bg-zinc-200",
        // 01 / Primary Actions (Mechanical Press) - Brand
        brand:
          "bg-indigo-600 text-white shadow-[0_3px_0_#3730a3] hover:bg-indigo-700 active:translate-y-[3px] active:shadow-none dark:bg-indigo-500 dark:shadow-[0_3px_0_#312e81] dark:hover:bg-indigo-600",
        // 02 / Secondary (Soft Scale)
        outline:
          "bg-white border border-slate-200 text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 active:scale-95 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
        // 02 / Ghost (Soft Scale)
        ghost:
          "bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 dark:text-slate-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800/50",
        // 03 / Destructive (State Inversion)
        destructive:
          "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-500 hover:text-white hover:border-rose-500 active:scale-95 dark:bg-rose-950/30 dark:border-rose-900 dark:text-rose-500 dark:hover:bg-rose-600 dark:hover:text-white dark:hover:border-rose-500",
        // 基础版 secondary 用于一些需要灰色底色的次级按钮
        secondary:
          "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200 active:scale-95 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700",
        link: "text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400",
      },
      size: {
        default: "h-10 px-5", // From Demo
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        icon: "w-10 h-10 rounded-full flex items-center justify-center p-0", // 04 / Icon Metrics
        "icon-sm": "w-8 h-8 rounded-md flex items-center justify-center p-0", // 04 / Icon Metrics
        floating: "h-16 w-16 rounded-full shadow-xl border-4 border-slate-50 absolute -top-8 dark:border-zinc-950",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
