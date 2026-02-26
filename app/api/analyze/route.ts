import { NextResponse } from 'next/server';
import { mainWorkflow } from '@/main_worker';

// main_worker は Node API に依存するため Node.js ランタイムを明示
export const runtime = 'nodejs';

// バックグラウンドタスクの状態管理（メモリ肥大化防止のため上限を設ける）
const TASK_STATUS_MAX = 50;
const TASK_TIMEOUT_MS = 5 * 60 * 1000; // 5分タイムアウト

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`タスクが${ms / 1000}秒以内に完了しませんでした`)), ms)
        ),
    ]);
}
const taskStatus: Record<string, { status: 'running' | 'completed' | 'failed'; result?: unknown; error?: string }> = {};
const taskIdOrder: string[] = [];

function evictOldTasks(): void {
    while (taskIdOrder.length >= TASK_STATUS_MAX) {
        const oldest = taskIdOrder.shift();
        if (oldest) delete taskStatus[oldest];
    }
}

const MAX_KEYWORD_LENGTH = 100;
const SKU_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { keyword, productSku } = body;

        if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
            return NextResponse.json({ success: false, error: 'キーワードを指定してください' }, { status: 400 });
        }

        const trimmedKeyword = keyword.trim().slice(0, MAX_KEYWORD_LENGTH);

        if (productSku && typeof productSku === 'string' && !SKU_PATTERN.test(productSku)) {
            return NextResponse.json({ success: false, error: 'SKUは英数字・ハイフン・アンダースコアのみ使用できます' }, { status: 400 });
        }

        evictOldTasks();
        const taskId = `analyze-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        taskStatus[taskId] = { status: 'running' };
        taskIdOrder.push(taskId);

        console.log(`[API Analyze] Starting background analysis for keyword: ${trimmedKeyword} (taskId: ${taskId})`);

        // バックグラウンドでワークフローを実行（レスポンスは即座に返す・タイムアウト付き）
        withTimeout(mainWorkflow([trimmedKeyword], 0.10, productSku || undefined), TASK_TIMEOUT_MS)
            .then((results) => {
                taskStatus[taskId] = { status: 'completed', result: results };
                console.log(`[API Analyze] Background analysis completed for keyword: ${trimmedKeyword} (taskId: ${taskId})`);
            })
            .catch((error: unknown) => {
                const msg = error instanceof Error ? error.message : String(error);
                taskStatus[taskId] = { status: 'failed', error: msg };
                console.error(`[API Analyze] Background analysis failed for keyword: ${trimmedKeyword} (taskId: ${taskId}):`, msg);
            });

        return NextResponse.json({
            success: true,
            message: `「${trimmedKeyword}」の分析をバックグラウンドで開始しました`,
            taskId,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[API Analyze] Error during analysis:', error);
        return NextResponse.json({
            success: false,
            error: `分析の開始に失敗しました: ${msg}`
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId || !taskStatus[taskId]) {
        return NextResponse.json({ success: false, error: 'タスクが見つかりません' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...taskStatus[taskId] });
}
