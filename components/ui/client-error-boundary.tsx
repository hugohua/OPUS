"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
    children?: ReactNode;
    fallbackMessage?: string;
    onRetry?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ClientErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error in component:", error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null });
        if (this.props.onRetry) {
            this.props.onRetry();
        }
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="w-full flex-col p-6 flex items-center justify-center border border-rose-100 bg-rose-50/50 rounded-xl mt-4">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 text-rose-500">
                        <AlertCircle strokeWidth={2} />
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1">
                        诊断服务暂时受限
                    </p>
                    <p className="text-xs text-slate-500 text-center px-4 mb-4">
                        {this.props.fallbackMessage ||
                            "AI 引擎可能遇到了轻微的网络波动或模型拥挤，这并不影响您查阅答案。"}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <RefreshCcw className="w-3.5 h-3.5" />
                        重试连接
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
