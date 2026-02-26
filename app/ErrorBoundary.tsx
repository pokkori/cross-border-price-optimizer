'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f172a] text-slate-100">
                    <div className="max-w-md text-center space-y-6">
                        <h1 className="text-xl font-bold text-slate-200">申し訳ございません</h1>
                        <p className="text-slate-400 text-sm">
                            予期しないエラーが発生しました。ページを再読み込みするか、ダッシュボードに戻ってください。
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all"
                            >
                                ページを再読み込み
                            </button>
                            <Link
                                href="/dashboard"
                                className="px-6 py-3 border border-slate-600 text-slate-300 hover:text-slate-100 rounded-xl font-bold transition-all text-center"
                            >
                                ダッシュボードに戻る
                            </Link>
                        </div>
                    </div>
                </main>
            );
        }
        return this.props.children;
    }
}
