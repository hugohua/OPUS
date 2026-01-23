/**
 * 身份验证相关 Zod Schema
 */
import { z } from "zod";

export const RegisterSchema = z.object({
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(6, "密码至少需要 6 位"),
    name: z.string().min(1, "请输入您的昵称"),
    inviteCode: z.string().min(1, "请输入邀请码"),
});

export const LoginSchema = z.object({
    email: z.string().email("请输入有效的邮箱地址"),
    password: z.string().min(1, "请输入密码"),
});
