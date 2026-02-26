import * as cheerio from 'cheerio';
import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import type { DataSource } from './types';

const AMAZON_SEARCH_URL = (keyword: string) =>
    `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;

export interface AmazonPriceItem {
    price: number;
    currency: string;
}

export interface AmazonPricesWithSource {
    items: AmazonPriceItem[];
    dataSource: DataSource;
}

/**
 * データソース付きでAmazon価格を取得する。
 * フォールバックチェーン: HTML scraping (ScrapingBee) -> モックデータ
 */
export async function fetchAmazonPricesWithSource(keyword: string): Promise<AmazonPricesWithSource> {
    // 1st: HTML scraping via ScrapingBee
    try {
        const url = AMAZON_SEARCH_URL(keyword);
        const html = await fetchHtmlWithScrapingBee(url, {
            javascript: true,
            premium_proxy: true,
            country_code: 'us',
        });
        const items = parseAmazonSearchPrices(html);
        if (items.length > 0) {
            console.log(`[amazonScraper] ScrapingBee returned ${items.length} prices for "${keyword}"`);
            return { items, dataSource: 'scraped' };
        }
        console.warn(`[amazonScraper] ScrapingBee returned 0 results for "${keyword}", using mock...`);
    } catch (e) {
        console.warn(`[amazonScraper] ScrapingBee failed for "${keyword}":`, e instanceof Error ? e.message : e);
    }

    // 2nd: モックデータ
    console.warn(`[amazonScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
    return { items: generateMockAmazonPrices(keyword), dataSource: 'mock' };
}

/**
 * Amazon 検索結果HTMLから価格をパースする。
 * セレクタ: [data-component-type="s-search-result"] の .a-price .a-offscreen
 */
function parseAmazonSearchPrices(html: string): AmazonPriceItem[] {
    const $ = cheerio.load(html);
    const prices: AmazonPriceItem[] = [];

    $('[data-component-type="s-search-result"]').each((_, el) => {
        const priceText = $(el).find('.a-price .a-offscreen').first().text().trim();
        if (!priceText) return;

        const cleaned = priceText.replace(/,/g, '');
        const numMatch = cleaned.match(/\$?\s*([\d.]+)/);
        if (numMatch) {
            const num = parseFloat(numMatch[1]);
            if (!isNaN(num) && num > 0) {
                prices.push({ price: num, currency: 'USD' });
            }
        }
    });

    return prices;
}

/**
 * ScrapingBee API が使えない場合のモックデータ。
 * eBayより5-10%高め（日本限定品のAmazonプレミアム）のUSD価格帯を返す。
 */
function generateMockAmazonPrices(keyword: string): AmazonPriceItem[] {
    const keywordPriceRanges: Record<string, number[]> = {
        'ポケモンカード': [94.99, 139.99, 189.99, 269.99, 374.99],
        '任天堂スイッチ': [214.99, 264.99, 299.99, 324.99, 374.99],
        'ゲームボーイ': [84.99, 129.99, 179.99, 234.99, 299.99],
        'フィギュア': [64.99, 129.99, 199.99, 269.99, 374.99],
        'アニメグッズ': [54.99, 109.99, 169.99, 234.99, 319.99],
        'レトロゲーム': [64.99, 109.99, 189.99, 264.99, 349.99],
        'トレカ': [54.99, 109.99, 179.99, 244.99, 319.99],
        'ワンピース': [64.99, 109.99, 179.99, 254.99, 339.99],
    };

    const defaultPrices = [64.99, 109.99, 179.99, 244.99, 319.99];
    const prices = keywordPriceRanges[keyword] || defaultPrices;

    return prices.map(price => ({ price, currency: 'USD' }));
}
