"use server";

/**
 * 身份验证 Server Actions
 */

import { z } from "zod";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import {
    validateLoginInput,
    validateRegisterInput,
    registerUserWithInviteCode,
    AUTH_ERROR_CODES,
} from "@/lib/auth/shared";
import { LoginSchema, RegisterSchema } from "@/lib/validations/auth";

export type ActionState<T = any> = {
    status: "success" | "error";
    message: string;
    data?: T;
    fieldErrors?: Record<string, string>;
};

export const registerAction = async (
    values: z.infer<typeof RegisterSchema>
): Promise<ActionState> => {
    const validatedFields = validateRegisterInput(values);
    if (!validatedFields.ok) {
        return {
            status: "error",
            message: "输入验证失败",
            fieldErrors: validatedFields.error.fieldErrors,
        };
    }

    const result = await registerUserWithInviteCode(validatedFields.data);
    if (!result.ok) {
        switch (result.error.code) {
            case AUTH_ERROR_CODES.INVALID_INVITE_CODE:
                return { status: "error", message: "无效或已过期的邀请码" };
            case AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED:
                return { status: "error", message: "该邮箱已被注册" };
            default:
                return { status: "error", message: "注册失败，请稍后重试" };
        }
    }

    return { status: "success", message: "注册成功！正在初始化工作台..." };
};

export const loginAction = async (
    values: z.infer<typeof LoginSchema>
): Promise<ActionState> => {
    const validatedFields = validateLoginInput(values);
    if (!validatedFields.ok) {
        return { status: "error", message: "输入验证失败" };
    }

    try {
        await signIn("credentials", {
            email: validatedFields.data.email,
            password: validatedFields.data.password,
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
