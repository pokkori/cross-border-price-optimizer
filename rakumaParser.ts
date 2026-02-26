import * as cheerio from 'cheerio';
import { RAKUMA_SEARCH_SELECTORS, cleanRakumaPrice } from './rakumaSelectors';
import { MarketPriceItem } from './types';

/**
 * Parses the HTML content of a Rakuma (fril.jp) search results page.
 * @param html The HTML content as a string.
 * @returns An array of parsed MarketPriceItem objects.
 */
export function parseRakumaSearchResults(html: string): MarketPriceItem[] {
    const $ = cheerio.load(html);
    const listings: MarketPriceItem[] = [];

    $(RAKUMA_SEARCH_SELECTORS.PRODUCT_LISTING).each((index, element) => {
        const titleElement = $(element).find(RAKUMA_SEARCH_SELECTORS.TITLE);
        const priceElement = $(element).find(RAKUMA_SEARCH_SELECTORS.PRICE);
        const linkElement = $(element).find(RAKUMA_SEARCH_SELECTORS.LINK);

        const title = titleElement.text().trim();
        const priceText = priceElement.text().trim();
        const relativeUrl = linkElement.attr('href');
        const imageUrl = $(element).find(RAKUMA_SEARCH_SELECTORS.IMAGE).attr('src');

        if (title && priceText && relativeUrl) {
            const price = cleanRakumaPrice(priceText);
            const listingUrl = relativeUrl.startsWith('http')
                ? relativeUrl
                : `https://fril.jp${relativeUrl}`;

            // Extract listingId from URL (e.g., /item/abc123)
            const listingIdMatch = listingUrl.match(/\/item\/([a-zA-Z0-9]+)/);
            const listingId = listingIdMatch ? listingIdMatch[1] : undefined;

            if (!isNaN(price) && price > 0) {
                listings.push({
                    platformName: 'Rakuma',
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
                console.warn(`[RakumaParser] Skipping listing due to invalid price: ${priceText} - ${title}`);
            }
        } else {
            console.warn(`[RakumaParser] Skipping listing due to missing data: Title: "${title}", Price: "${priceText}", URL: "${relativeUrl}"`);
        }
    });

    if (listings.length === 0) {
        console.warn("[RakumaParser] No listings found on the page. Check selectors or page structure.");
    }

    return listings;
}
