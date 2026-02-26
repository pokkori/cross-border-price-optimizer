import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import { parsePayPayFleamarketSearchResults } from './paypayFleamarketParser';
import { PAYPAY_FLEAMARKET_BASE_SEARCH_URL } from './paypayFleamarketSelectors';
import { MarketPriceItem } from './types';

/**
 * Scrapes PayPayフリマ for product listings based on a keyword.
 * @param keyword The search keyword.
 * @returns An array of MarketPriceItem objects.
 */
export async function scrapePayPayFleamarket(keyword: string): Promise<MarketPriceItem[]> {
    console.log(`[PayPayFleamarketScraper] Starting PayPayフリマ scrape for keyword: "${keyword}"`);
    const searchUrl = PAYPAY_FLEAMARKET_BASE_SEARCH_URL(keyword);

    try {
        const htmlContent = await fetchHtmlWithScrapingBee(searchUrl, {
            javascript: true,
            premium_proxy: true,
            country_code: 'jp',
            wait_for: '.ItemList__item',
        });

        const listings = parsePayPayFleamarketSearchResults(htmlContent);
        console.log(`[PayPayFleamarketScraper] Found ${listings.length} listings for "${keyword}"`);
        return listings;

    } catch (error: any) {
        console.error(`[PayPayFleamarketScraper] Error scraping PayPayフリマ for "${keyword}":`, error.message);

        // Fallback to mock data
        console.warn(`[PayPayFleamarketScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
        const mockUrl = PAYPAY_FLEAMARKET_BASE_SEARCH_URL(keyword);
        return [
            {
                listingId: `paypay-mock-${Date.now()}-1`,
                platformName: 'PayPayフリマ',
                title: `${keyword} - 美品 (Mock)`,
                price: 11000,
                currency: 'JPY',
                condition: 'Used',
                listingUrl: mockUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=PayPay+Mock',
                dataSource: 'mock',
            },
            {
                listingId: `paypay-mock-${Date.now()}-2`,
                platformName: 'PayPayフリマ',
                title: `${keyword} - 新品未開封 (Mock)`,
                price: 23000,
                currency: 'JPY',
                condition: 'New',
                listingUrl: mockUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=PayPay+Mock',
                dataSource: 'mock',
            },
        ];
    }
}
