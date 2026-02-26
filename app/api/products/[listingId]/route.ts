import { NextResponse } from 'next/server';
import { supabase } from '@/supabaseClient';

export const runtime = 'nodejs';

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ listingId: string }> }
) {
    try {
        const { listingId } = await params;
        if (!listingId) {
            return NextResponse.json({ success: false, error: 'listingId required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('market_prices')
            .select('*')
            .eq('listing_id', listingId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching listing:', error.message);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!data) {
            return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
        }

        const item = {
            ...data,
            imageUrl: data.image_url,
            optimizedEnglishDescription: data.optimized_english_description,
            optimalPrice: data.optimal_price,
            profitDetails: data.profit_details,
            profitMargin: data.profit_margin,
            listingUrl: data.listing_url,
            listingId: data.listing_id,
            productSku: data.product_sku,
            platformId: data.platform_id,
            scrapedAt: data.scraped_at,
            dataSource: data.data_source,
        };

        return NextResponse.json({ success: true, data: item });
    } catch (err) {
        console.error('Error reading product:', err);
        return NextResponse.json({ success: false, error: 'Failed to read data' }, { status: 500 });
    }
}
