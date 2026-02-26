import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import { parseMercariSearchResults } from './mercariParser';
import { MERCARI_BASE_SEARCH_URL } from './mercariSelectors';
import { MarketPriceItem } from './types';

/**
 * Scrapes Mercari for product listings based on a keyword.
 * @param keyword The search keyword.
 * @returns An array of MarketPriceItem objects.
 */
export async function scrapeMercari(keyword: string): Promise<MarketPriceItem[]> {
    console.log(`[MercariScraper] Starting Mercari scrape for keyword: "${keyword}"`);
    const searchUrl = MERCARI_BASE_SEARCH_URL(keyword);

    try {
        const htmlContent = await fetchHtmlWithScrapingBee(searchUrl, {
            javascript: true, // Mercari heavily relies on JavaScript
            premium_proxy: true, // Use premium proxies for better success rate
            country_code: 'jp', // Target Japan for Mercari JP
            wait_for: 'li[data-testid="item-cell"]', // Wait for items to load
        });

        const listings = parseMercariSearchResults(htmlContent);
        console.log(`[MercariScraper] Found ${listings.length} listings for "${keyword}"`);
        return listings;

    } catch (error: any) {
        console.error(`[MercariScraper] Error scraping Mercari for "${keyword}":`, error.message);

        // Fallback to mock data if scraping fails (e.g. no API key)
        console.warn(`[MercariScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
        const searchUrl = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}`;
        return [
            {
                listingId: `mock-${Date.now()}-1`,
                platformName: 'Mercari',
                title: `${keyword} - 美品 (Mock)`,
                price: 15000,
                currency: 'JPY',
                condition: 'Used',
                listingUrl: searchUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=Mock',
                dataSource: 'mock',
            },
            {
                listingId: `mock-${Date.now()}-2`,
                platformName: 'Mercari',
                title: `${keyword} - 新品未開封 (Mock)`,
                price: 28000,
                currency: 'JPY',
                condition: 'New',
                listingUrl: searchUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=Mock',
                dataSource: 'mock',
            }
        ];
    }
}
