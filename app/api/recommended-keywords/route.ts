import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/supabaseClient';
import { scrapeMercari } from '@/mercariScraper';
import { scrapeYahooAuctions } from '@/yahooAuctionsScraper';
import { scrapeRakuma } from '@/rakumaScraper';
import { scrapePayPayFleamarket } from '@/paypayFleamarketScraper';
import { fetchEbayPricesWithSource } from '@/ebayScraper';
import { fetchAmazonPricesWithSource } from '@/amazonScraper';
import { fetchStockXPricesWithSource } from '@/stockxScraper';
import { fetchMercariUsPricesWithSource } from '@/mercariUsScraper';
import type { DataSource } from '@/types';

export const runtime = 'nodejs';

const MAX_KEYWORDS = 12;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10分
const MAX_PRODUCTS_PER_KEYWORD = 3;
const MAX_PRODUCTS_TOTAL = 15;

/** 価格比較の候補キーワード（国内・海外で検索して利益を試算） */
const CANDIDATE_KEYWORDS = [
    'ポケモンカード',
    '任天堂スイッチ',
    'ゲームボーイ',
    'フィギュア',
    'アニメグッズ',
    'レトロゲーム',
    'トレカ',
    'ワンピース',
];

/** 簡易利益試算: 海外売上(JPY) - 国内仕入(JPY) - 海外手数料 - 送料 - 関税概算。利益がこの値以上ならおすすめに載せる */
const MIN_PROFIT_JPY = 1100;
const ROUGH_SHIPPING_JPY = 3500;
// 実際の手数料率に合わせた定数（profitCalculator.ts の値と統一）
const OVERSEAS_FEE_RATE_EBAY = 0.1290;       // 12.9%
const EBAY_FIXED_FEE_USD = 0.30;             // $0.30/件固定
const OVERSEAS_FEE_RATE_AMAZON = 0.15;       // 15%（カテゴリ不明のためデフォルト）
const OVERSEAS_FEE_RATE_STOCKX = 0.12;       // 12%（取引9%+決済3%）
const OVERSEAS_FEE_RATE_MERCARI_US = 0.10;   // 10%
// US向け関税概算: de minimis $800超の場合のみ適用（平均的な関税率5%を概算）
const US_CUSTOMS_RATE_APPROX = 0.05;
const US_DEMINIMIS_USD = 800;

interface RecommendedProduct {
    keyword: string;
    title: string;
    // 最適な国内ソース
    domesticPrice: number;
    domesticPlatform: string;
    domesticDataSource: DataSource;
    domesticUrl: string;
    // 最適な海外ソース
    overseasPrice: number;
    overseasPlatform: string;
    overseasDataSource: DataSource;
    overseasSearchUrl: string;
    // 利益
    estimatedProfitJpy: number;
    profitMarginPercent: number;
    imageUrl: string;
    exchangeRate: number;
    bestCombination: string;
    // 後方互換フィールド
    mercariPrice: number;
    ebayPriceUsd: number;
    mercariUrl: string;
    ebaySearchUrl: string;
    ebayDataSource: DataSource;
    mercariDataSource: DataSource;
    // Amazon情報
    amazonPriceUsd?: number;
    amazonDataSource?: DataSource;
    amazonSearchUrl?: string;
    // ヤフオク情報
    yahooPrice?: number;
    yahooDataSource?: DataSource;
    yahooUrl?: string;
    // ラクマ情報
    rakumaPrice?: number;
    rakumaDataSource?: DataSource;
    rakumaUrl?: string;
    // PayPayフリマ情報
    paypayPrice?: number;
    paypayDataSource?: DataSource;
    paypayUrl?: string;
    // StockX情報
    stockxPriceUsd?: number;
    stockxDataSource?: DataSource;
    stockxSearchUrl?: string;
    // Mercari US情報
    mercariUsPriceUsd?: number;
    mercariUsDataSource?: DataSource;
    mercariUsSearchUrl?: string;
}

let cached: { keywords: string[]; products: RecommendedProduct[]; at: number; exchangeRate: number; exchangeRateSource: string } | null = null;

/**
 * リアルタイム為替レート取得（3段フォールバック）
 * 1. 無料API (open.er-api.com) — キー不要
 * 2. Supabase DB
 * 3. ハードコード ¥149
 */
async function fetchExchangeRate(): Promise<{ rate: number; source: string }> {
    // 1st: 無料API
    try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', {
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const data = await res.json() as { rates?: { JPY?: number } };
            if (data.rates?.JPY && data.rates.JPY > 0) {
                const rate = Math.round(data.rates.JPY * 100) / 100;
                console.log(`[recommended-keywords] Live exchange rate: 1 USD = ${rate} JPY`);

                // Supabaseにも保存（upsert）
                if (isSupabaseConfigured()) {
                    try {
                        await supabase
                            .from('exchange_rates')
                            .upsert(
                                {
                                    from_currency: 'USD',
                                    to_currency: 'JPY',
                                    rate,
                                    updated_at: new Date().toISOString(),
                                },
                                { onConflict: 'from_currency,to_currency' },
                            );
                    } catch {
                        // upsert失敗は無視
                    }
                }

                return { rate, source: 'live' };
            }
        }
    } catch (e) {
        console.warn('[recommended-keywords] Live exchange rate API failed:', e instanceof Error ? e.message : e);
    }

    // 2nd: Supabase DB
    if (isSupabaseConfigured()) {
        try {
            const { data: usdToJpy } = await supabase
                .from('exchange_rates')
                .select('rate')
                .eq('from_currency', 'USD')
                .eq('to_currency', 'JPY')
                .single();
            if (usdToJpy?.rate) {
                const rate = Number(usdToJpy.rate);
                console.log(`[recommended-keywords] DB exchange rate: 1 USD = ${rate} JPY`);
                return { rate, source: 'database' };
            }

            const { data: jpyToUsd } = await supabase
                .from('exchange_rates')
                .select('rate')
                .eq('from_currency', 'JPY')
                .eq('to_currency', 'USD')
                .single();
            if (jpyToUsd?.rate) {
                const rate = Math.round((1 / Number(jpyToUsd.rate)) * 100) / 100;
                console.log(`[recommended-keywords] DB exchange rate (inverted): 1 USD = ${rate} JPY`);
                return { rate, source: 'database' };
            }
        } catch {
            // DB取得失敗は無視
        }
    }

    // 3rd: ハードコード
    console.warn('[recommended-keywords] Using hardcoded exchange rate: 1 USD = 149 JPY');
    return { rate: 149, source: 'hardcoded' };
}

/**
 * USD価格配列から中央値を算出する
 */
function calcMedianUsd(items: { price: number; currency: string }[]): number {
    const usdPrices = items
        .filter((i) => i.currency === 'USD' && i.price > 0)
        .map((i) => i.price)
        .slice(0, 5);
    const sorted = [...usdPrices].sort((a, b) => a - b);
    return sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;
}

/**
 * 国内4（メルカリ・ヤフオク・ラクマ・PayPayフリマ）・海外4（eBay・Amazon・StockX・Mercari US）の
 * 価格を参照し、利益が出そうなキーワードだけをおすすめとして返す。
 * 最適な仕入先・販売先の組み合わせを選択する。
 */
export async function GET() {
    try {
        if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
            return NextResponse.json({
                success: true,
                keywords: cached.keywords,
                products: cached.products,
                fromPriceCheck: true,
                exchangeRate: cached.exchangeRate,
                exchangeRateSource: cached.exchangeRateSource,
            });
        }

        const { rate: jpyPerUsd, source: exchangeRateSource } = await fetchExchangeRate();

        const profitable: string[] = [];
        const allProducts: RecommendedProduct[] = [];
        const toCheck = CANDIDATE_KEYWORDS.slice(0, 4); // タイムアウト防止

        for (const keyword of toCheck) {
            try {
                // 8スクレイパー並列実行（Promise.allSettledで1つの失敗が全体に影響しないようにする）
                const results = await Promise.allSettled([
                    scrapeMercari(keyword),
                    scrapeYahooAuctions(keyword),
                    scrapeRakuma(keyword),
                    scrapePayPayFleamarket(keyword),
                    fetchEbayPricesWithSource(keyword),
                    fetchAmazonPricesWithSource(keyword),
                    fetchStockXPricesWithSource(keyword),
                    fetchMercariUsPricesWithSource(keyword),
                ]);

                // 結果を安全に取り出す
                const mercariListings = results[0].status === 'fulfilled' ? results[0].value : [];
                const yahooListings = results[1].status === 'fulfilled' ? results[1].value : [];
                const rakumaListings = results[2].status === 'fulfilled' ? results[2].value : [];
                const paypayListings = results[3].status === 'fulfilled' ? results[3].value : [];
                const ebayResult = results[4].status === 'fulfilled' ? results[4].value : { items: [], dataSource: 'mock' as DataSource };
                const amazonResult = results[5].status === 'fulfilled' ? results[5].value : { items: [], dataSource: 'mock' as DataSource };
                const stockxResult = results[6].status === 'fulfilled' ? results[6].value : { items: [], dataSource: 'mock' as DataSource };
                const mercariUsResult = results[7].status === 'fulfilled' ? results[7].value : { items: [], dataSource: 'mock' as DataSource };

                // 各海外プラットフォームの中央値
                const midEbayUsd = calcMedianUsd(ebayResult.items);
                const midAmazonUsd = calcMedianUsd(amazonResult.items);
                const midStockXUsd = calcMedianUsd(stockxResult.items);
                const midMercariUsUsd = calcMedianUsd(mercariUsResult.items);

                if (midEbayUsd === 0 && midAmazonUsd === 0 && midStockXUsd === 0 && midMercariUsUsd === 0) continue;

                const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&_sacat=0`;
                const amazonSearchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
                const stockxSearchUrl = `https://stockx.com/search?s=${encodeURIComponent(keyword)}`;
                const mercariUsSearchUrl = `https://www.mercari.com/search/?keyword=${encodeURIComponent(keyword)}`;

                // 全国内リスティング統合（メルカリ+ヤフオク+ラクマ+PayPayフリマ）
                const allDomesticListings = [
                    ...mercariListings.filter(l => l.price > 0 && l.title).slice(0, 10).map(l => ({
                        ...l,
                        platform: 'メルカリ' as const,
                        platformEn: 'Mercari' as const,
                    })),
                    ...yahooListings.filter(l => l.price > 0 && l.title).slice(0, 10).map(l => ({
                        ...l,
                        platform: 'ヤフオク' as const,
                        platformEn: 'Yahoo Auctions' as const,
                    })),
                    ...rakumaListings.filter(l => l.price > 0 && l.title).slice(0, 10).map(l => ({
                        ...l,
                        platform: 'ラクマ' as const,
                        platformEn: 'Rakuma' as const,
                    })),
                    ...paypayListings.filter(l => l.price > 0 && l.title).slice(0, 10).map(l => ({
                        ...l,
                        platform: 'PayPayフリマ' as const,
                        platformEn: 'PayPayフリマ' as const,
                    })),
                ];

                // データソース判定
                const mercariDataSource: DataSource = mercariListings.length > 0 && mercariListings[0]?.listingUrl && mercariListings[0].listingUrl !== '#'
                    ? 'api'
                    : 'mock';
                const yahooDataSource: DataSource = yahooListings.length > 0 && yahooListings[0]?.dataSource
                    ? yahooListings[0].dataSource
                    : 'mock';
                const rakumaDataSource: DataSource = rakumaListings.length > 0 && rakumaListings[0]?.dataSource
                    ? rakumaListings[0].dataSource
                    : 'mock';
                const paypayDataSource: DataSource = paypayListings.length > 0 && paypayListings[0]?.dataSource
                    ? paypayListings[0].dataSource
                    : 'mock';

                // 商品単位で最適な組み合わせを計算
                const keywordProducts: RecommendedProduct[] = [];

                for (const listing of allDomesticListings) {
                    let bestProfit = -Infinity;
                    let bestOverseasPlatform = 'eBay';
                    let bestOverseasPrice = midEbayUsd;
                    let bestOverseasDataSource: DataSource = ebayResult.dataSource;
                    let bestOverseasSearchUrl = ebaySearchUrl;

                    // 海外4プラットフォームの利益比較
                    // fixedFeeUsd: 1取引あたりの固定手数料 (eBay $0.30など)
                    const overseasCandidates = [
                        { platform: 'eBay', price: midEbayUsd, feeRate: OVERSEAS_FEE_RATE_EBAY, fixedFeeUsd: EBAY_FIXED_FEE_USD, ds: ebayResult.dataSource, url: ebaySearchUrl },
                        { platform: 'Amazon', price: midAmazonUsd, feeRate: OVERSEAS_FEE_RATE_AMAZON, fixedFeeUsd: 0, ds: amazonResult.dataSource, url: amazonSearchUrl },
                        { platform: 'StockX', price: midStockXUsd, feeRate: OVERSEAS_FEE_RATE_STOCKX, fixedFeeUsd: 0, ds: stockxResult.dataSource, url: stockxSearchUrl },
                        { platform: 'Mercari US', price: midMercariUsUsd, feeRate: OVERSEAS_FEE_RATE_MERCARI_US, fixedFeeUsd: 0, ds: mercariUsResult.dataSource, url: mercariUsSearchUrl },
                    ];

                    for (const candidate of overseasCandidates) {
                        if (candidate.price > 0) {
                            const revenueJpy = candidate.price * jpyPerUsd;
                            // 手数料（料率 + 固定費）
                            const platformFeeJpy = revenueJpy * candidate.feeRate + candidate.fixedFeeUsd * jpyPerUsd;
                            // 関税概算: de minimis $800超の場合のみ適用（US向け）
                            const customsJpy = candidate.price > US_DEMINIMIS_USD
                                ? revenueJpy * US_CUSTOMS_RATE_APPROX : 0;
                            const profit = revenueJpy - platformFeeJpy - listing.price - ROUGH_SHIPPING_JPY - customsJpy;
                            if (profit > bestProfit) {
                                bestProfit = profit;
                                bestOverseasPlatform = candidate.platform;
                                bestOverseasPrice = candidate.price;
                                bestOverseasDataSource = candidate.ds;
                                bestOverseasSearchUrl = candidate.url;
                            }
                        }
                    }

                    if (bestProfit >= MIN_PROFIT_JPY) {
                        const revenueJpy = bestOverseasPrice * jpyPerUsd;
                        const bestCombination = `${listing.platform} → ${bestOverseasPlatform}`;

                        keywordProducts.push({
                            keyword,
                            title: listing.title,
                            // 最適国内ソース
                            domesticPrice: listing.price,
                            domesticPlatform: listing.platformEn,
                            domesticDataSource: listing.dataSource,
                            domesticUrl: listing.listingUrl || '#',
                            // 最適海外ソース
                            overseasPrice: bestOverseasPrice,
                            overseasPlatform: bestOverseasPlatform,
                            overseasDataSource: bestOverseasDataSource,
                            overseasSearchUrl: bestOverseasSearchUrl,
                            // 利益
                            estimatedProfitJpy: Math.floor(bestProfit),
                            profitMarginPercent: revenueJpy > 0
                                ? Math.round((bestProfit / revenueJpy) * 100) / 100
                                : 0,
                            imageUrl: listing.imageUrl || 'https://placehold.co/400x300/1e293b/FFFFFF?text=No+Image',
                            exchangeRate: jpyPerUsd,
                            bestCombination,
                            // 後方互換
                            mercariPrice: listing.platformEn === 'Mercari' ? listing.price : 0,
                            ebayPriceUsd: midEbayUsd,
                            mercariUrl: listing.platformEn === 'Mercari' ? (listing.listingUrl || '#') : '#',
                            ebaySearchUrl,
                            ebayDataSource: ebayResult.dataSource,
                            mercariDataSource,
                            // Amazon情報
                            amazonPriceUsd: midAmazonUsd > 0 ? midAmazonUsd : undefined,
                            amazonDataSource: midAmazonUsd > 0 ? amazonResult.dataSource : undefined,
                            amazonSearchUrl: midAmazonUsd > 0 ? amazonSearchUrl : undefined,
                            // ヤフオク情報
                            yahooPrice: listing.platformEn === 'Yahoo Auctions' ? listing.price : (yahooListings.length > 0 ? yahooListings[0].price : undefined),
                            yahooDataSource: yahooDataSource !== 'mock' ? yahooDataSource : undefined,
                            yahooUrl: listing.platformEn === 'Yahoo Auctions' ? (listing.listingUrl || undefined) : (yahooListings.length > 0 ? yahooListings[0].listingUrl : undefined),
                            // ラクマ情報
                            rakumaPrice: listing.platformEn === 'Rakuma' ? listing.price : (rakumaListings.length > 0 ? rakumaListings[0].price : undefined),
                            rakumaDataSource: rakumaDataSource !== 'mock' ? rakumaDataSource : undefined,
                            rakumaUrl: listing.platformEn === 'Rakuma' ? (listing.listingUrl || undefined) : (rakumaListings.length > 0 ? rakumaListings[0].listingUrl : undefined),
                            // PayPayフリマ情報
                            paypayPrice: listing.platformEn === 'PayPayフリマ' ? listing.price : (paypayListings.length > 0 ? paypayListings[0].price : undefined),
                            paypayDataSource: paypayDataSource !== 'mock' ? paypayDataSource : undefined,
                            paypayUrl: listing.platformEn === 'PayPayフリマ' ? (listing.listingUrl || undefined) : (paypayListings.length > 0 ? paypayListings[0].listingUrl : undefined),
                            // StockX情報
                            stockxPriceUsd: midStockXUsd > 0 ? midStockXUsd : undefined,
                            stockxDataSource: midStockXUsd > 0 ? stockxResult.dataSource : undefined,
                            stockxSearchUrl: midStockXUsd > 0 ? stockxSearchUrl : undefined,
                            // Mercari US情報
                            mercariUsPriceUsd: midMercariUsUsd > 0 ? midMercariUsUsd : undefined,
                            mercariUsDataSource: midMercariUsUsd > 0 ? mercariUsResult.dataSource : undefined,
                            mercariUsSearchUrl: midMercariUsUsd > 0 ? mercariUsSearchUrl : undefined,
                        });
                    }
                }

                // このキーワードで利益が出る商品があればキーワードもおすすめに
                if (keywordProducts.length > 0) {
                    profitable.push(keyword);
                    // 利益額の高い順にソートして上位N件
                    keywordProducts.sort((a, b) => b.estimatedProfitJpy - a.estimatedProfitJpy);
                    allProducts.push(...keywordProducts.slice(0, MAX_PRODUCTS_PER_KEYWORD));
                }
            } catch (e) {
                console.warn(`[recommended-keywords] Skip keyword "${keyword}":`, e);
            }
        }

        // 全体を利益額の高い順にソートして上限を適用
        allProducts.sort((a, b) => b.estimatedProfitJpy - a.estimatedProfitJpy);
        const finalProducts = allProducts.slice(0, MAX_PRODUCTS_TOTAL);

        let keywords = profitable.slice(0, MAX_KEYWORDS);
        // 価格取得に失敗して1件もない場合（例: ScrapingBee未設定でeBayが取れない）は候補を参考表示
        const fallback = keywords.length === 0 ? CANDIDATE_KEYWORDS.slice(0, 6) : keywords;
        const fromPriceCheck = keywords.length > 0;
        cached = { keywords: fallback, products: finalProducts, at: Date.now(), exchangeRate: jpyPerUsd, exchangeRateSource };

        return NextResponse.json({
            success: true,
            keywords: fallback,
            fromPriceCheck, // true = 価格比較で選定, false = 候補の参考表示
            products: finalProducts,
            exchangeRate: jpyPerUsd,
            exchangeRateSource,
        });
    } catch (e) {
        console.error('[API recommended-keywords]', e);
        const fallback = CANDIDATE_KEYWORDS.slice(0, 6);
        return NextResponse.json({
            success: true,
            keywords: cached?.keywords ?? fallback,
            fromPriceCheck: false,
            products: cached?.products ?? [],
            exchangeRate: cached?.exchangeRate ?? 149,
            exchangeRateSource: cached?.exchangeRateSource ?? 'hardcoded',
        });
    }
}
