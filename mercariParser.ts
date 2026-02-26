import * as cheerio from 'cheerio';
import { MERCARI_SEARCH_SELECTORS, cleanMercariPrice } from './mercariSelectors';
import { MarketPriceItem } from './types'; // Now correctly imported

/**
 * Parses the HTML content of a Mercari search results page.
 * @param html The HTML content as a string.
 * @returns An array of parsed MarketPriceItem objects.
 */
export function parseMercariSearchResults(html: string): MarketPriceItem[] {
    const $ = cheerio.load(html);
    const listings: MarketPriceItem[] = [];

    $(MERCARI_SEARCH_SELECTORS.PRODUCT_LISTING).each((index, element) => {
        const titleElement = $(element).find(MERCARI_SEARCH_SELECTORS.TITLE);
        const priceElement = $(element).find(MERCARI_SEARCH_SELECTORS.PRICE);
        const linkElement = $(element).find(MERCARI_SEARCH_SELECTORS.LINK);

        const title = titleElement.text().trim();
        const priceText = priceElement.text().trim();
        const relativeUrl = linkElement.attr('href');
        const imageUrl = $(element).find(MERCARI_SEARCH_SELECTORS.IMAGE).attr('src');

        // Basic validation
        if (title && priceText && relativeUrl) {
            const price = cleanMercariPrice(priceText);
            // Handle both relative and absolute URLs
            const listingUrl = relativeUrl.startsWith('http')
                ? relativeUrl
                : `https://jp.mercari.com${relativeUrl}`;

            // Extract listingId from URL (e.g., from /item/m12345678901)
            const listingIdMatch = listingUrl.match(/\/item\/(m\d+)/);
            const listingId = listingIdMatch ? listingIdMatch[1] : undefined;


            if (!isNaN(price) && price > 0) {
                listings.push({
                    platformName: 'Mercari',
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
                console.warn(`[MercariParser] Skipping listing due to invalid price: ${priceText} - ${title}`);
            }
        } else {
            console.warn(`[MercariParser] Skipping listing due to missing data: Title: "${title}", Price: "${priceText}", URL: "${relativeUrl}"`);
        }
    });

    if (listings.length === 0) {
        console.warn("[MercariParser] No listings found on the page. Check selectors or page structure.");
    }

    return listings;
}
