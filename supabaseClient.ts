import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase接続設定
 *
 * 優先順位:
 *   URL:  SUPABASE_URL > NEXT_PUBLIC_SUPABASE_URL（後方互換）
 *   KEY:  SUPABASE_SERVICE_ROLE_KEY > SUPABASE_ANON_KEY > NEXT_PUBLIC_SUPABASE_ANON_KEY（後方互換）
 *
 * SUPABASE_SERVICE_ROLE_KEY を設定すると:
 *   - RLS（Row Level Security）をバイパスしてサーバーサイドから全テーブルにアクセス可能
 *   - 絶対にブラウザに渡してはならない（NEXT_PUBLIC_ プレフィックスを付けないこと）
 *   - Supabase ダッシュボード > Project Settings > API > service_role key で取得
 *
 * SUPABASE_ANON_KEY（非 NEXT_PUBLIC_）を使うことで:
 *   - キー値がブラウザの JS バンドルに含まれなくなる
 *   - RLS が有効な場合、ポリシーに従ったアクセス制御が適用される
 */
const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    '';

// Service Role Key が設定されていればそれを最優先で使用（サーバーサイド専用）
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    '';

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
        // サーバーサイド専用クライアントのためセッション永続化を無効化
        persistSession: false,
        autoRefreshToken: false,
    },
});

export function isSupabaseConfigured(): boolean {
    return Boolean(supabaseUrl && supabaseKey);
}
