"use server";

/**
 * 身份验证 Server Actions
 */

import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { RegisterSchema, LoginSchema } from "@/lib/validations/auth";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export type ActionState<T = any> = {
    status: "success" | "error";
    message: string;
    data?: T;
    fieldErrors?: Record<string, string>;
};

export const registerAction = async (
    values: z.infer<typeof RegisterSchema>
): Promise<ActionState> => {
    // 1. 验证字段
    const validatedFields = RegisterSchema.safeParse(values);
    if (!validatedFields.success) {
        return {
            status: "error",
            message: "输入验证失败",
            fieldErrors: Object.fromEntries(
                Object.entries(validatedFields.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] || ""])
            ),
        };
    }

    const { email, password, name, inviteCode } = validatedFields.data;

    // 2. 校验邀请码
    const validCode = await db.invitationCode.findUnique({
        where: { code: inviteCode },
    });

    if (!validCode || !validCode.isActive || validCode.usedCount >= validCode.maxUses) {
        return { status: "error", message: "无效或已过期的邀请码" };
    }

    // 3. 校验邮箱唯一性
    const existingUser = await db.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        return { status: "error", message: "该邮箱已被注册" };
    }

    // 4. 创建用户并扣减邀请码
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await db.$transaction([
            db.user.create({
                data: {
                    name,
                    email,
                    password: hashedPassword,
                    invitedByCode: inviteCode,
                },
            }),
            db.invitationCode.update({
                where: { id: validCode.id },
                data: { usedCount: { increment: 1 } },
            }),
        ]);
    } catch (error) {
        console.error("Registration error:", error);
        return { status: "error", message: "注册失败，请稍后重试" };
    }

    return { status: "success", message: "注册成功！正在初始化工作台..." };
};

export const loginAction = async (
    values: z.infer<typeof LoginSchema>
): Promise<ActionState> => {
    const validatedFields = LoginSchema.safeParse(values);

    if (!validatedFields.success) {
        return { status: "error", message: "输入验证失败" };
    }

    const { email, password } = validatedFields.data;

    try {
        await signIn("credentials", {
            email,
            password,
            redirect: false, // Handle redirect in client
        });

        return { status: "success", message: "登录成功" };
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { status: "error", message: "邮箱或密码错误" };
                default:
                    return { status: "error", message: "登录失败" };
            }
        }
        // NextAuth throws error on success if redirect is true, but here redirect is false.
        // However, if we change redirect logic, be careful.
        throw error;
    }
};
