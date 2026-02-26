import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import { parseRakumaSearchResults } from './rakumaParser';
import { RAKUMA_BASE_SEARCH_URL } from './rakumaSelectors';
import { MarketPriceItem } from './types';

/**
 * Scrapes Rakuma (fril.jp) for product listings based on a keyword.
 * @param keyword The search keyword.
 * @returns An array of MarketPriceItem objects.
 */
export async function scrapeRakuma(keyword: string): Promise<MarketPriceItem[]> {
    console.log(`[RakumaScraper] Starting Rakuma scrape for keyword: "${keyword}"`);
    const searchUrl = RAKUMA_BASE_SEARCH_URL(keyword);

    try {
        const htmlContent = await fetchHtmlWithScrapingBee(searchUrl, {
            javascript: true,
            premium_proxy: true,
            country_code: 'jp',
            wait_for: '.item-box',
        });

        const listings = parseRakumaSearchResults(htmlContent);
        console.log(`[RakumaScraper] Found ${listings.length} listings for "${keyword}"`);
        return listings;

    } catch (error: any) {
        console.error(`[RakumaScraper] Error scraping Rakuma for "${keyword}":`, error.message);

        // Fallback to mock data
        console.warn(`[RakumaScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
        const mockUrl = RAKUMA_BASE_SEARCH_URL(keyword);
        return [
            {
                listingId: `rakuma-mock-${Date.now()}-1`,
                platformName: 'Rakuma',
                title: `${keyword} - 美品 (Mock)`,
                price: 13000,
                currency: 'JPY',
                condition: 'Used',
                listingUrl: mockUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=Rakuma+Mock',
                dataSource: 'mock',
            },
            {
                listingId: `rakuma-mock-${Date.now()}-2`,
                platformName: 'Rakuma',
                title: `${keyword} - 新品未開封 (Mock)`,
                price: 25000,
                currency: 'JPY',
                condition: 'New',
                listingUrl: mockUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=Rakuma+Mock',
                dataSource: 'mock',
            },
        ];
    }
}
