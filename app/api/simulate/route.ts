import { NextResponse } from 'next/server';
import { calculateProfit } from '@/profitCalculator';
import { DomesticPlatform, OverseasPlatform, ProfitCalculationError } from '@/types';
import { isSupabaseConfigured } from '@/supabaseClient';

// SupabaseやNode APIを使うため Node.js ランタイムを明示
export const runtime = 'nodejs';

function translateProfitError(message: string): string {
    if (message.includes('not found')) {
        if (message.includes('Product with SKU')) {
            const sku = message.match(/SKU (.+?) not/)?.[1] || '';
            return `SKU「${sku}」の商品がデータベースに見つかりません。productsテーブルに商品を登録してください。`;
        }
        if (message.includes('platform')) return 'プラットフォーム情報がデータベースに見つかりません。';
        if (message.includes('Exchange rate')) return '為替レートがデータベースに登録されていません。exchange_ratesテーブルを確認してください。';
    }
    if (message.includes('weight_kg') || message.includes('hs_code')) {
        return '商品に重量(weight_kg)またはHSコード(hs_code)が設定されていません。productsテーブルを更新してください。';
    }
    if (message.includes('shipping')) return '配送先に対応する送料が見つかりません。shipping_zones/shipping_ratesテーブルを確認してください。';
    if (message.includes('domestic purchase price')) return '国内仕入価格が不正です。manualDomesticPriceを指定するか、productsテーブルのpurchase_priceを設定してください。';
    if (message.includes('overseas selling price')) return '海外販売価格が不正です。正の数値を入力してください。';
    return message;
}

export async function POST(request: Request) {
    try {
        if (!isSupabaseConfigured()) {
            return NextResponse.json(
                { success: false, error: 'Supabaseの接続設定がありません。.env.local に NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください。' },
                { status: 503 }
            );
        }
        const body = await request.json();

        const {
            productSku,
            domesticPlatform,
            overseasPlatform,
            destinationCountryCode,
            manualDomesticPrice,
            targetSellingPriceOverseas,
        } = body;

        const sku = typeof productSku === 'string' ? productSku.trim() : '';
        const destCountry = typeof destinationCountryCode === 'string' ? destinationCountryCode.trim().toUpperCase() : '';
        const validDomestic = ['Mercari', 'Yahoo Auctions', 'Rakuma', 'PayPayフリマ'].includes(domesticPlatform);
        const validOverseas = ['eBay', 'StockX', 'Amazon', 'Mercari US'].includes(overseasPlatform);

        if (!sku || !validDomestic || !validOverseas || !destCountry || destCountry.length < 2 || targetSellingPriceOverseas === undefined) {
            return NextResponse.json(
                { success: false, error: '必須項目が不足または不正です。（SKU, 国内: Mercari/Yahoo Auctions/Rakuma/PayPayフリマ, 海外: eBay/StockX/Amazon/Mercari US, 配送先国コード2文字以上, 目標販売価格）' },
                { status: 400 }
            );
        }

        const manualDomesticPriceNum =
            typeof manualDomesticPrice === 'number'
                ? manualDomesticPrice
                : manualDomesticPrice
                ? Number(manualDomesticPrice)
                : undefined;

        const targetSellingPriceOverseasNum =
            typeof targetSellingPriceOverseas === 'number'
                ? targetSellingPriceOverseas
                : Number(targetSellingPriceOverseas);

        if (Number.isNaN(targetSellingPriceOverseasNum) || targetSellingPriceOverseasNum <= 0) {
            return NextResponse.json(
                { success: false, error: '目標販売価格が不正です。正の数値を入力してください。' },
                { status: 400 }
            );
        }

        const input = {
            productSku: sku,
            domesticPlatform: domesticPlatform as DomesticPlatform,
            overseasPlatform: overseasPlatform as OverseasPlatform,
            destinationCountryCode: destCountry,
            targetSellingPriceOverseas: targetSellingPriceOverseasNum,
            manualDomesticPrice: manualDomesticPriceNum,
        };

        const details = await calculateProfit(input);

        return NextResponse.json({
            success: true,
            data: details,
        });
    } catch (error: unknown) {
        console.error('[API Simulate] Error during simulation:', error);

        const message =
            error instanceof ProfitCalculationError
                ? translateProfitError(error.message)
                : error instanceof Error ? error.message : 'シミュレーション中に予期せぬエラーが発生しました。';

        return NextResponse.json(
            {
                success: false,
                error: message,
            },
            { status: 500 }
        );
    }
}

