"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/auth/auth-card";
import { InviteInput } from "@/components/auth/invite-input";
import { RegisterSchema } from "@/lib/validations/auth";
import { registerAction } from "@/actions/auth";

export default function RegisterPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof RegisterSchema>>({
        resolver: zodResolver(RegisterSchema),
        defaultValues: {
            email: "",
            password: "",
            name: "",
            inviteCode: "",
        },
    });

    const onSubmit = (values: z.infer<typeof RegisterSchema>) => {
        startTransition(async () => {
            try {
                const result = await registerAction(values);

                if (result.status === "error") {
                    toast.error(result.message);
                    // Handle field errors if any (simple implementation)
                    return;
                }

                toast.success(result.message);
                // Auto login is not implemented in logic, so redirect to login
                router.push("/login");
            } catch (e) {
                toast.error("初始化过程中发生错误");
            }
        });
    };

    return (
        <AuthCard
            title="Opus."
            description="NEW_USER_PROTOCOL"
        >
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                {/* Invite Code - Priority Field */}
                <InviteInput
                    label="Invitation Key"
                    placeholder="XXXX-XXXX-XXXX"
                    error={form.formState.errors.inviteCode?.message}
                    {...form.register("inviteCode")}
                    disabled={isPending}
                />

                <div className="grid gap-4 mt-6">
                    <div className="space-y-2">
                        <Label htmlFor="name">Display Name</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground stroke-[1.5px]" />
                            <Input id="name" placeholder="John Doe" className="pl-9" {...form.register("name")} disabled={isPending} />
                        </div>
                        {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground stroke-[1.5px]" />
                            <Input id="email" type="email" placeholder="name@example.com" className="pl-9" {...form.register("email")} disabled={isPending} />
                        </div>
                        {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground stroke-[1.5px]" />
                            <Input id="password" type="password" placeholder="••••••••" className="pl-9" {...form.register("password")} disabled={isPending} />
                        </div>
                        {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
                    </div>
                </div>

                <Button type="submit" className="w-full mt-6" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Initialize Account"}
                </Button>

                <div className="text-center text-sm text-muted-foreground mt-4">
                    <span className="opacity-70">Already authorized? </span>
                    <Link href="/login" className="underline hover:text-primary transition-colors">
                        Login
                    </Link>
                </div>
            </form>
        </AuthCard>
    );
}
