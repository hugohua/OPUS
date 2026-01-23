import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface InviteInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string
    error?: string
}

const InviteInput = React.forwardRef<HTMLInputElement, InviteInputProps>(
    ({ className, type, label, error, onChange, ...props }, ref) => {

        // Auto-uppercase handler
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            e.target.value = e.target.value.toUpperCase();
            if (onChange) onChange(e);
        };

        return (
            <div className="space-y-2">
                {label && <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70">{label}</Label>}
                <div className="relative">
                    <Input
                        type={type}
                        className={cn(
                            "font-mono text-base tracking-[0.2em] text-center uppercase transition-all duration-300",
                            "focus-visible:ring-primary focus-visible:border-primary",
                            error && "border-destructive focus-visible:ring-destructive",
                            className
                        )}
                        ref={ref}
                        onChange={handleChange}
                        maxLength={20}
                        placeholder="XXXX-XXXX-XXXX"
                        {...props}
                    />
                </div>
                {error && <p className="text-[0.8rem] font-medium text-destructive">{error}</p>}
            </div>
        )
    }
)
InviteInput.displayName = "InviteInput"

export { InviteInput }
