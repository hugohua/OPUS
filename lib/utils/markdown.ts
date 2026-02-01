/**
 * Markdown 工具函数
 * 
 * 提供统一的 Markdown 处理方法，避免在多个组件中重复相同逻辑
 */

/**
 * 将 Markdown 加粗标记 (**text**) 转换为 HTML <strong> 标签
 * 
 * @param text - 包含 Markdown 加粗标记的文本
 * @param className - strong 标签的 CSS 类名（可选）
 * @returns 转换后的 HTML 字符串
 * 
 * @example
 * ```ts
 * boldToHtml("The **merger** caused chaos")
 * // => "The <strong>merger</strong> caused chaos"
 * 
 * boldToHtml("**并购**引发混乱", "font-bold text-zinc-200")
 * // => "<strong class=\"font-bold text-zinc-200\">并购</strong>引发混乱"
 * ```
 */
export function boldToHtml(text: string, className?: string): string {
    const classAttr = className ? ` class="${className}"` : '';
    return text.replace(/\*\*(.*?)\*\*/g, `<strong${classAttr}>$1</strong>`);
}

/**
 * 移除 Markdown 加粗标记，保留纯文本
 * 
 * @param text - 包含 Markdown 加粗标记的文本
 * @returns 移除标记后的纯文本
 * 
 * @example
 * ```ts
 * stripBold("The **merger** caused chaos")
 * // => "The merger caused chaos"
 * ```
 */
export function stripBold(text: string): string {
    return text.replace(/\*\*/g, '');
}

/**
 * 检测文本是否包含 Markdown 加粗标记
 * 
 * @param text - 待检测的文本
 * @returns 是否包含加粗标记
 */
export function hasBold(text: string): boolean {
    return /\*\*.*?\*\*/.test(text);
}
