// 标准 Action 返回格式（符合规范 4.A）
export type ActionState<T = unknown> = {
    status: 'success' | 'error';
    message: string;
    data?: T;
    fieldErrors?: Record<string, string>;
};

// 导出所有类型
export * from './ai';
export * from './article';
