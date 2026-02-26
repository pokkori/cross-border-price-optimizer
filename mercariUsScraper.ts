import * as cheerio from 'cheerio';
import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import type { DataSource, MercariUsPriceItem, MercariUsPricesWithSource } from './types';

const MERCARI_US_SEARCH_URL = (keyword: string) =>
    `https://www.mercari.com/search/?keyword=${encodeURIComponent(keyword)}`;

/**
 * データソース付きでMercari US価格を取得する。
 * フォールバックチェーン: HTML scraping (ScrapingBee) -> モックデータ
 */
export async function fetchMercariUsPricesWithSource(keyword: string): Promise<MercariUsPricesWithSource> {
    // 1st: HTML scraping via ScrapingBee
    try {
        const url = MERCARI_US_SEARCH_URL(keyword);
        const html = await fetchHtmlWithScrapingBee(url, {
            javascript: true,
            premium_proxy: true,
            country_code: 'us',
        });
        const items = parseMercariUsSearchPrices(html);
        if (items.length > 0) {
            console.log(`[mercariUsScraper] ScrapingBee returned ${items.length} prices for "${keyword}"`);
            return { items, dataSource: 'scraped' };
        }
        console.warn(`[mercariUsScraper] ScrapingBee returned 0 results for "${keyword}", using mock...`);
    } catch (e) {
        console.warn(`[mercariUsScraper] ScrapingBee failed for "${keyword}":`, e instanceof Error ? e.message : e);
    }

    // 2nd: モックデータ
    console.warn(`[mercariUsScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
    return { items: generateMockMercariUsPrices(keyword), dataSource: 'mock' };
}

/**
 * Mercari US 検索結果HTMLから価格をパースする。
 */
function parseMercariUsSearchPrices(html: string): MercariUsPriceItem[] {
    const $ = cheerio.load(html);
    const prices: MercariUsPriceItem[] = [];

    // Mercari US uses data-testid attributes
    $('[data-testid="ItemCell"], [data-testid="SearchResults"] [data-testid="ItemCell"]').each((_, el) => {
        const priceText = $(el).find('[data-testid="ItemPrice"]').first().text().trim();
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
 * Mercari USの価格帯を返す（eBayより若干安め）。
 */
function generateMockMercariUsPrices(keyword: string): MercariUsPriceItem[] {
    const keywordPriceRanges: Record<string, number[]> = {
        'ポケモンカード': [80, 120, 170, 240, 340],
        '任天堂スイッチ': [180, 230, 260, 290, 340],
        'ゲームボーイ': [70, 110, 160, 210, 270],
        'フィギュア': [50, 110, 180, 240, 340],
        'アニメグッズ': [40, 90, 150, 210, 290],
        'レトロゲーム': [50, 90, 170, 240, 320],
        'トレカ': [40, 90, 160, 220, 290],
        'ワンピース': [50, 90, 160, 230, 310],
    };

    const defaultPrices = [50, 90, 160, 220, 290];
    const prices = keywordPriceRanges[keyword] || defaultPrices;

    return prices.map(price => ({ price, currency: 'USD' }));
}
