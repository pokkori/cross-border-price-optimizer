import * as cheerio from 'cheerio';
import { YAHOO_AUCTIONS_SEARCH_SELECTORS, cleanYahooAuctionsPrice } from './yahooAuctionsSelectors';
import { MarketPriceItem } from './types';

/**
 * Parses the HTML content of a Yahoo Auctions search results page.
 * @param html The HTML content as a string.
 * @returns An array of parsed MarketPriceItem objects.
 */
export function parseYahooAuctionsSearchResults(html: string): MarketPriceItem[] {
    const $ = cheerio.load(html);
    const listings: MarketPriceItem[] = [];

    $(YAHOO_AUCTIONS_SEARCH_SELECTORS.PRODUCT_LISTING).each((index, element) => {
        const titleElement = $(element).find(YAHOO_AUCTIONS_SEARCH_SELECTORS.TITLE);
        const priceElement = $(element).find(YAHOO_AUCTIONS_SEARCH_SELECTORS.PRICE);
        const linkElement = $(element).find(YAHOO_AUCTIONS_SEARCH_SELECTORS.LINK);

        const title = titleElement.text().trim();
        const priceText = priceElement.text().trim();
        const relativeUrl = linkElement.attr('href');
        const imageUrl = $(element).find(YAHOO_AUCTIONS_SEARCH_SELECTORS.IMAGE).attr('src');

        if (title && priceText && relativeUrl) {
            const price = cleanYahooAuctionsPrice(priceText);
            const listingUrl = relativeUrl.startsWith('http')
                ? relativeUrl
                : `https://page.auctions.yahoo.co.jp${relativeUrl}`;

            // Extract auction ID from URL (e.g., /jp/auction/x123456789)
            const listingIdMatch = listingUrl.match(/\/auction\/([a-zA-Z0-9]+)/);
            const listingId = listingIdMatch ? listingIdMatch[1] : undefined;

            if (!isNaN(price) && price > 0) {
                listings.push({
                    platformName: 'Yahoo Auctions',
                    listingId: listingId,
                    title: title,
                    price: price,
                    currency: 'JPY',
                    listingUrl: listingUrl,
                    imageUrl: imageUrl,
                    scrapedAt: new Date().toISOString(),
                    dataSource: 'scraped',
                });
            } else {
                console.warn(`[YahooAuctionsParser] Skipping listing due to invalid price: ${priceText} - ${title}`);
            }
        } else {
            console.warn(`[YahooAuctionsParser] Skipping listing due to missing data: Title: "${title}", Price: "${priceText}", URL: "${relativeUrl}"`);
        }
    });

    if (listings.length === 0) {
        console.warn("[YahooAuctionsParser] No listings found on the page. Check selectors or page structure.");
    }

    return listings;
}
