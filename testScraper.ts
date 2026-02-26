import { scrapeMercari } from './mercariScraper';
import { MarketPriceItem } from './types';

async function runScraperTest() {
    console.log("--- Starting Mercari Scraper Test ---");

    const testKeyword = "任天堂スイッチ"; // Example keyword

    try {
        const listings: MarketPriceItem[] = await scrapeMercari(testKeyword);

        if (listings.length > 0) {
            console.log(`
--- Scraped Mercari Listings for "${testKeyword}" ---`);
            listings.slice(0, 5).forEach((item, index) => { // Log first 5 items
                console.log(`
Listing ${index + 1}:`);
                console.log(`  Title: ${item.title}`);
                console.log(`  Price: ${item.price} ${item.currency}`);
                console.log(`  URL: ${item.listingUrl}`);
                console.log(`  Listing ID: ${item.listingId}`);
            });
            if (listings.length > 5) {
                console.log(`...and ${listings.length - 5} more listings.`);
            }
        } else {
            console.log(`No listings found for "${testKeyword}".`);
        }

    } catch (error: any) {
        console.error("Mercari Scraper Test Error:", error.message);
    }
    console.log(`
--- Mercari Scraper Test Finished ---`);
}

runScraperTest();
