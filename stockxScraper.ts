import * as cheerio from 'cheerio';
import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import type { DataSource, StockXPriceItem, StockXPricesWithSource } from './types';

const STOCKX_SEARCH_URL = (keyword: string) =>
    `https://stockx.com/search?s=${encodeURIComponent(keyword)}`;

/**
 * データソース付きでStockX価格を取得する。
 * フォールバックチェーン: HTML scraping (ScrapingBee) -> モックデータ
 */
export async function fetchStockXPricesWithSource(keyword: string): Promise<StockXPricesWithSource> {
    // 1st: HTML scraping via ScrapingBee
    try {
        const url = STOCKX_SEARCH_URL(keyword);
        const html = await fetchHtmlWithScrapingBee(url, {
            javascript: true,
            premium_proxy: true,
            country_code: 'us',
        });
        const items = parseStockXSearchPrices(html);
        if (items.length > 0) {
            console.log(`[stockxScraper] ScrapingBee returned ${items.length} prices for "${keyword}"`);
            return { items, dataSource: 'scraped' };
        }
        console.warn(`[stockxScraper] ScrapingBee returned 0 results for "${keyword}", using mock...`);
    } catch (e) {
        console.warn(`[stockxScraper] ScrapingBee failed for "${keyword}":`, e instanceof Error ? e.message : e);
    }

    // 2nd: モックデータ
    console.warn(`[stockxScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
    return { items: generateMockStockXPrices(keyword), dataSource: 'mock' };
}

/**
 * StockX 検索結果HTMLから価格をパースする。
 * StockXは動的なReactアプリのため、セレクタは変動する可能性あり。
 */
function parseStockXSearchPrices(html: string): StockXPriceItem[] {
    const $ = cheerio.load(html);
    const prices: StockXPriceItem[] = [];

    // StockXの価格表示: product-tile内のcss-price, またはdata-testid="product-tile"
    $('[data-testid="product-tile"], .css-1xpz4pz').each((_, el) => {
        const priceText = $(el).find('.css-price, [data-testid="product-price"]').first().text().trim();
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
 * スニーカー・コレクティブル寄りの価格帯を返す。
 */
function generateMockStockXPrices(keyword: string): StockXPriceItem[] {
    const keywordPriceRanges: Record<string, number[]> = {
        'ポケモンカード': [95, 150, 220, 380, 550],
        '任天堂スイッチ': [220, 280, 320, 380, 450],
        'ゲームボーイ': [120, 180, 250, 350, 500],
        'フィギュア': [80, 150, 250, 380, 550],
        'アニメグッズ': [60, 120, 200, 320, 480],
        'レトロゲーム': [100, 180, 280, 400, 600],
        'トレカ': [75, 140, 220, 350, 500],
        'ワンピース': [70, 130, 210, 330, 480],
        'スニーカー': [150, 250, 350, 500, 800],
        'Jordan': [180, 285, 400, 550, 900],
    };

    const defaultPrices = [100, 165, 250, 380, 550];
    const prices = keywordPriceRanges[keyword] || defaultPrices;

    return prices.map(price => ({ price, currency: 'USD' }));
}
