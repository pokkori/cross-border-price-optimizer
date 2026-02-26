import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import { parseYahooAuctionsSearchResults } from './yahooAuctionsParser';
import { YAHOO_AUCTIONS_BASE_SEARCH_URL } from './yahooAuctionsSelectors';
import { MarketPriceItem } from './types';

/**
 * Scrapes Yahoo Auctions for product listings based on a keyword.
 * @param keyword The search keyword.
 * @returns An array of MarketPriceItem objects.
 */
export async function scrapeYahooAuctions(keyword: string): Promise<MarketPriceItem[]> {
    console.log(`[YahooAuctionsScraper] Starting Yahoo Auctions scrape for keyword: "${keyword}"`);
    const searchUrl = YAHOO_AUCTIONS_BASE_SEARCH_URL(keyword);

    try {
        const htmlContent = await fetchHtmlWithScrapingBee(searchUrl, {
            javascript: true,
            premium_proxy: true,
            country_code: 'jp',
            wait_for: '.Product',
        });

        const listings = parseYahooAuctionsSearchResults(htmlContent);
        console.log(`[YahooAuctionsScraper] Found ${listings.length} listings for "${keyword}"`);
        return listings;

    } catch (error: any) {
        console.error(`[YahooAuctionsScraper] Error scraping Yahoo Auctions for "${keyword}":`, error.message);

        // Fallback to mock data (10-20% cheaper than Mercari)
        console.warn(`[YahooAuctionsScraper] Falling back to MOCK data for "${keyword}". Results are NOT real market data.`);
        const searchUrl = YAHOO_AUCTIONS_BASE_SEARCH_URL(keyword);
        return [
            {
                listingId: `yahoo-mock-${Date.now()}-1`,
                platformName: 'Yahoo Auctions',
                title: `${keyword} - 美品 (Mock)`,
                price: 12000,
                currency: 'JPY',
                condition: 'Used',
                listingUrl: searchUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=Yahoo+Mock',
                dataSource: 'mock',
            },
            {
                listingId: `yahoo-mock-${Date.now()}-2`,
                platformName: 'Yahoo Auctions',
                title: `${keyword} - 新品未開封 (Mock)`,
                price: 24000,
                currency: 'JPY',
                condition: 'New',
                listingUrl: searchUrl,
                scrapedAt: new Date().toISOString(),
                imageUrl: 'https://placehold.co/400x300/1e293b/FFFFFF?text=Yahoo+Mock',
                dataSource: 'mock',
            },
        ];
    }
}
