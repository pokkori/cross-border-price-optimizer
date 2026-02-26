import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/supabaseClient';

export const runtime = 'nodejs';

const DEFAULT_LIMIT = 50;

/** 直近の activity_logs を取得（簡易ログ閲覧用） */
export async function GET(request: Request) {
    try {
        if (!isSupabaseConfigured()) {
            return NextResponse.json({ success: true, data: [] });
        }
        const { searchParams } = new URL(request.url);
        const limit = Math.min(Number(searchParams.get('limit')) || DEFAULT_LIMIT, 200);

        const { data, error } = await supabase
            .from('activity_logs')
            .select('id, timestamp, workflow_name, status, message, product_sku, details')
            .order('timestamp', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[API activity-logs]', error.message);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data || [] });
    } catch (e) {
        console.error('[API activity-logs]', e);
        return NextResponse.json({ success: false, error: 'Failed to fetch logs' }, { status: 500 });
    }
}
