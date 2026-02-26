import * as cheerio from 'cheerio';
import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import type { DataSource } from './types';

const EBAY_SEARCH_URL = (keyword: string) =>
    `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}&_sacat=0`;

export interface EbayPriceItem {
    price: number;
    currency: string;
}

export interface EbayPricesWithSource {
    items: EbayPriceItem[];
    dataSource: DataSource;
}

// --- eBay OAuth2 Token Cache ---
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * eBay OAuth2 Client Credentials でアクセストークンを取得。
 * モジュールレベルでキャッシュし、有効期限の60秒前に再取得する。
 */
async function getEbayAccessToken(): Promise<string> {
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error('EBAY_CLIENT_ID or EBAY_CLIENT_SECRET not configured');
    }

    // キャッシュが有効ならそのまま返す
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch('https://api.ebay.com/identity/v1/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
        },
        body: 'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`eBay OAuth failed (${res.status}): ${text}`);
    }

    const data = await res.json() as { access_token: string; expires_in: number };
    const expiresAt = Date.now() + (data.expires_in - 60) * 1000; // 60秒マージン

    cachedToken = { token: data.access_token, expiresAt };
    console.log('[ebayScraper] eBay OAuth token acquired');

    return data.access_token;
}

/**
 * eBay Browse API で検索し、価格一覧を返す。
 */
async function fetchEbayPricesViaApi(keyword: string): Promise<EbayPriceItem[]> {
    const token = await getEbayAccessToken();
    const params = new URLSearchParams({
        q: keyword,
        limit: '10',
        filter: 'buyingOptions:{FIXED_PRICE}',
    });

    const res = await fetch(
        `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`,
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
                'Content-Type': 'application/json',
            },
        },
    );

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`eBay Browse API error (${res.status}): ${text}`);
    }

    const data = await res.json() as {
        itemSummaries?: Array<{
            price?: { value?: string; currency?: string };
        }>;
    };

    const items: EbayPriceItem[] = [];
    if (data.itemSummaries) {
        for (const item of data.itemSummaries) {
            const value = parseFloat(item.price?.value || '');
            const currency = item.price?.currency || 'USD';
            if (!isNaN(value) && value > 0) {
                items.push({ price: value, currency });
            }
        }
    }

    console.log(`[ebayScraper] eBay Browse API returned ${items.length} prices for "${keyword}"`);
    return items;
}

/**
 * データソース付きでeBay価格を取得する。
 * フォールバックチェーン: eBay Browse API -> HTML scraping (ScrapingBee) -> モックデータ
 */
export async function fetchEbayPricesWithSource(keyword: string): Promise<EbayPricesWithSource> {
    // 1st: eBay Browse API
    try {
        const items = await fetchEbayPricesViaApi(keyword);
        if (items.length > 0) {
            return { items, dataSource: 'api' };
        }
        console.warn(`[ebayScraper] eBay Browse API returned 0 results for "${keyword}", trying scraping...`);
    } catch (e) {
        console.warn(`[ebayScraper] eBay Browse API failed for "${keyword}":`, e instanceof Error ? e.message : e);
    }

    // 2nd: HTML scraping via ScrapingBee
    try {
        const url = EBAY_SEARCH_URL(keyword);
        const html = await fetchHtmlWithScrapingBee(url, {
            javascript: true,
            country_code: 'us',
        });
        const items = parseEbaySearchPrices(html);
        if (items.length > 0) {
            console.log(`[ebayScraper] ScrapingBee returned ${items.length} prices for "${keyword}"`);
            return { items, dataSource: 'scraped' };
        }
        console.warn(`[ebayScraper] ScrapingBee returned 0 results for "${keyword}", using mock...`);
    } catch (e) {
        console.warn(`[ebayScraper] ScrapingBee failed for "${keyword}":`, e instanceof Error ? e.message : e);
    }

    // 3rd: モックデータ
    console.warn(`[ebayScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
    return { items: generateMockEbayPrices(keyword), dataSource: 'mock' };
}

/**
 * eBay 検索結果から価格を取得する（後方互換）。
 * 内部的には fetchEbayPricesWithSource を使い、同じ3段フォールバックを実行。
 */
export async function fetchEbayPricesForKeyword(keyword: string): Promise<EbayPriceItem[]> {
    const result = await fetchEbayPricesWithSource(keyword);
    return result.items;
}

/**
 * ScrapingBee API が使えない場合のモックデータ。
 * キーワードに応じた現実的な USD 価格帯を返す。
 */
function generateMockEbayPrices(keyword: string): EbayPriceItem[] {
    // 中央値が $150〜$280 程度になるよう設定。
    // メルカリ MOCK 仕入価格（¥15,000）と比較して利益が出る水準。
    // 利益試算: midEbayUsd * 149 * 0.87 - 15000 - 3500 >= 1100 → midEbayUsd >= ~$152
    const keywordPriceRanges: Record<string, number[]> = {
        'ポケモンカード': [89.99, 129.99, 179.99, 249.99, 349.99],
        '任天堂スイッチ': [199.99, 249.99, 279.99, 299.99, 349.99],
        'ゲームボーイ': [79.99, 119.99, 169.99, 219.99, 279.99],
        'フィギュア': [59.99, 119.99, 189.99, 249.99, 349.99],
        'アニメグッズ': [49.99, 99.99, 159.99, 219.99, 299.99],
        'レトロゲーム': [59.99, 99.99, 179.99, 249.99, 329.99],
        'トレカ': [49.99, 99.99, 169.99, 229.99, 299.99],
        'ワンピース': [59.99, 99.99, 169.99, 239.99, 319.99],
    };

    const defaultPrices = [59.99, 99.99, 169.99, 229.99, 299.99];
    const prices = keywordPriceRanges[keyword] || defaultPrices;

    return prices.map(price => ({ price, currency: 'USD' }));
}

/**
 * eBay 検索結果HTMLから価格をパースする。
 * セレクタ: .s-item__price（eBay 検索結果の価格表示）
 */
function parseEbaySearchPrices(html: string): EbayPriceItem[] {
    const $ = cheerio.load(html);
    const prices: EbayPriceItem[] = [];

    $('.s-item').each((_, el) => {
        const priceText = $(el).find('.s-item__price').first().text().trim();
        if (!priceText) return;

        // "$12.99" or "JPY 1,234" など。先頭の数値を取り、通貨を判定
        const cleaned = priceText.replace(/,/g, '');
        const numMatch = cleaned.match(/\$?\s*([\d.]+)/);
        if (numMatch) {
            const num = parseFloat(numMatch[1]);
            if (!isNaN(num) && num > 0) {
                const currency = cleaned.includes('JPY') || cleaned.includes('¥') ? 'JPY' : 'USD';
                prices.push({ price: num, currency });
            }
        }
    });

    return prices;
}
