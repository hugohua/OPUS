import "server-only";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { LoginSchema, RegisterSchema } from "@/lib/validations/auth";
import { z } from "zod";

export const AUTH_ERROR_CODES = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    INVALID_INVITE_CODE: "INVALID_INVITE_CODE",
    EMAIL_ALREADY_REGISTERED: "EMAIL_ALREADY_REGISTERED",
    UNAUTHORIZED: "UNAUTHORIZED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type AuthErrorCode = typeof AUTH_ERROR_CODES[keyof typeof AUTH_ERROR_CODES];

export type AuthUser = {
    id: string;
    name: string | null;
    email: string;
};

export type AuthFailure = {
    code: AuthErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
};

export type AuthValidationResult<T> =
    | { ok: true; data: T }
    | { ok: false; error: AuthFailure };

type RegistrationInput = z.infer<typeof RegisterSchema>;
type LoginInput = z.infer<typeof LoginSchema>;

const HASH_ROUNDS = 10;

class InviteQuotaExceededError extends Error {
    constructor() {
        super("Invite quota exceeded");
        this.name = "InviteQuotaExceededError";
    }
}

function mapFieldErrors(error: z.ZodError): Record<string, string> {
    const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;

    return Object.fromEntries(
        Object.entries(fieldErrors).map(([key, value]) => [key, value?.[0] ?? ""])
    );
}

function validationFailure(error: z.ZodError): AuthFailure {
    return {
        code: AUTH_ERROR_CODES.VALIDATION_ERROR,
        message: "Validation failed",
        fieldErrors: mapFieldErrors(error),
    };
}

function mapUser(user: { id: string; name: string | null; email: string }): AuthUser {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
    };
}

function isUniqueConstraintError(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

export function validateLoginInput(input: unknown): AuthValidationResult<LoginInput> {
    const validated = LoginSchema.safeParse(input);
    if (!validated.success) {
        return { ok: false, error: validationFailure(validated.error) };
    }

    return { ok: true, data: validated.data };
}

export function validateRegisterInput(input: unknown): AuthValidationResult<RegistrationInput> {
    const validated = RegisterSchema.safeParse(input);
    if (!validated.success) {
        return { ok: false, error: validationFailure(validated.error) };
    }

    return { ok: true, data: validated.data };
}

export async function getUserByEmail(email: string): Promise<AuthUser | null> {
    const user = await db.user.findUnique({
        where: { email },
        select: { id: true, name: true, email: true },
    });

    return user ? mapUser(user) : null;
}

export async function getUserById(id: string): Promise<AuthUser | null> {
    const user = await db.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true },
    });

    return user ? mapUser(user) : null;
}

export async function authenticateUserByCredentials(input: unknown): Promise<AuthUser | null> {
    const validated = validateLoginInput(input);
    if (!validated.ok) {
        return null;
    }

    const user = await db.user.findUnique({
        where: { email: validated.data.email },
        select: { id: true, name: true, email: true, password: true },
    });

    if (!user?.password) {
        return null;
    }

    const passwordsMatch = await bcrypt.compare(validated.data.password, user.password);
    if (!passwordsMatch) {
        return null;
    }

    return mapUser(user);
}

export async function registerUserWithInviteCode(
    input: RegistrationInput
): Promise<{ ok: true; user: AuthUser } | { ok: false; error: AuthFailure }> {
    const hashedPassword = await bcrypt.hash(input.password, HASH_ROUNDS);

    try {
        const user = await db.$transaction(async (tx) => {
            const claimedInviteCode = await tx.$queryRaw<Array<{ id: string }>>`
                UPDATE "InvitationCode"
                SET "usedCount" = "usedCount" + 1
                WHERE "code" = ${input.inviteCode}
                  AND "isActive" = true
                  AND "usedCount" < "maxUses"
                  AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
                RETURNING "id"
            `;

            if (claimedInviteCode.length === 0) {
                throw new InviteQuotaExceededError();
            }

            const createdUser = await tx.user.create({
                data: {
                    name: input.name,
                    email: input.email,
                    password: hashedPassword,
                    invitedByCode: input.inviteCode,
                },
                select: { id: true, name: true, email: true },
            });

            return createdUser;
        });

        return { ok: true, user: mapUser(user) };
    } catch (error) {
        if (error instanceof InviteQuotaExceededError) {
            return {
                ok: false,
                error: {
                    code: AUTH_ERROR_CODES.INVALID_INVITE_CODE,
                    message: "Invite code is invalid or expired",
                },
            };
        }

        if (isUniqueConstraintError(error)) {
            return {
                ok: false,
                error: {
                    code: AUTH_ERROR_CODES.EMAIL_ALREADY_REGISTERED,
                    message: "Email is already registered",
                },
            };
        }

        return {
            ok: false,
            error: {
                code: AUTH_ERROR_CODES.INTERNAL_ERROR,
                message: "Unable to create user",
            },
        };
    }
}
