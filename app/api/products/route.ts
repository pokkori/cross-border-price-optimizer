import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/supabaseClient';

// Supabaseクライアントを使用するため Node.js ランタイムを明示
export const runtime = 'nodejs';

export async function GET() {
    try {
        if (!isSupabaseConfigured()) {
            return NextResponse.json(
                { success: false, error: 'Supabaseの接続設定がありません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。' },
                { status: 503 }
            );
        }
        const { data, error } = await supabase
            .from('market_prices')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) {
            console.error("Error fetching market prices from Supabase:", error.message);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        // Map snake_case DB columns to camelCase for dashboard compatibility
        const mappedData = (data || []).map((item: any) => ({
            ...item,
            imageUrl: item.image_url,
            optimizedEnglishDescription: item.optimized_english_description,
            optimalPrice: item.optimal_price,
            profitDetails: item.profit_details,
            profitMargin: item.profit_margin,
            listingUrl: item.listing_url,
            listingId: item.listing_id,
            productSku: item.product_sku,
            platformId: item.platform_id,
            scrapedAt: item.scraped_at,
            dataSource: item.data_source,
        }));

        return NextResponse.json({ success: true, data: mappedData });
    } catch (error) {
        console.error("Error reading product data:", error);
        return NextResponse.json({ success: false, error: "Failed to read data" }, { status: 500 });
    }
}
