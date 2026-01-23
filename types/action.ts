export type ActionState<T = any> = {
    status: "success" | "error";
    message: string;
    data?: T;
    fieldErrors?: Record<string, string>;
};
