import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/supabaseClient';

export const runtime = 'nodejs';

/** 分析時に紐づけ可能な商品(SKU)一覧を返す */
export async function GET() {
    try {
        if (!isSupabaseConfigured()) {
            return NextResponse.json({ success: true, items: [] });
        }
        const { data, error } = await supabase
            .from('products')
            .select('sku, name')
            .order('sku');

        if (error) {
            console.error('[API product-skus]', error.message);
            return NextResponse.json({ success: true, items: [] });
        }
        const items = (data || []).map((r: { sku: string; name?: string }) => ({
            sku: r.sku,
            name: r.name || r.sku,
        }));
        return NextResponse.json({ success: true, items });
    } catch {
        return NextResponse.json({ success: true, items: [] });
    }
}
