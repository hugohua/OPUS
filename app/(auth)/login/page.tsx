"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginSchema } from "@/lib/validations/auth";
import { loginAction } from "@/actions/auth";

export default function LoginPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const form = useForm<z.infer<typeof LoginSchema>>({
        resolver: zodResolver(LoginSchema),
        defaultValues: {
            email: "",
            password: "",
        },
    });

    const onSubmit = (values: z.infer<typeof LoginSchema>) => {
        startTransition(async () => {
            try {
                const result = await loginAction(values);

                if (result.status === "error") {
                    toast.error(result.message);
                    return;
                }

                toast.success(result.message);
                router.push("/dashboard");
                router.refresh();
            } catch (e) {
                toast.error("登录时发生未知错误");
            }
        });
    };

    return (
        <AuthCard
            title="Opus."
            description="系统初始化"
        >
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="email">邮箱</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground stroke-[1.5px]" />
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            className="pl-9"
                            {...form.register("email")}
                            disabled={isPending}
                        />
                    </div>
                    {form.formState.errors.email && (
                        <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="password">密码</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground stroke-[1.5px]" />
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            className="pl-9"
                            {...form.register("password")}
                            disabled={isPending}
                        />
                    </div>
                    {form.formState.errors.password && (
                        <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full mt-6" disabled={isPending}>
                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "验证身份"}
                </Button>

                <div className="text-center text-sm text-muted-foreground mt-4">
                    <span className="opacity-70">权限受限。</span>
                    <Link href="/register" className="underline hover:text-primary transition-colors">
                        使用邀请码
                    </Link>
                </div>
            </form>
        </AuthCard>
    );
}
