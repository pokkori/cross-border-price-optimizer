import { fetchHtmlWithScrapingBee } from './scrapingbeeService';
import * as cheerio from 'cheerio';

async function analyze() {
    const url = 'https://jp.mercari.com/search?keyword=Nintendo%20Switch';
    console.log(`Fetching ${url} with JS rendering and wait_for...`);
    try {
        const html = await fetchHtmlWithScrapingBee(url, {
            javascript: true,
            wait_for: 'li[data-testid="item-cell"]',
            premium_proxy: true
        });
        const $ = cheerio.load(html);

        console.log("--- Data Test IDs Found ---");
        const testIds = new Set<string>();
        $('[data-testid]').each((i, el) => {
            const tid = $(el).attr('data-testid');
            if (tid) testIds.add(tid);
        });
        Array.from(testIds).sort().forEach(tid => console.log(tid));

        console.log("\n--- Verification of Specific Selectors ---");
        const items = $('li[data-testid="item-cell"]');
        console.log(`Found ${items.length} items with li[data-testid="item-cell"]`);

        if (items.length > 0) {
            const first = items.first();
            console.log("Title (thumbnail-item-name):", first.find('[data-testid="thumbnail-item-name"]').text().trim());
            console.log("Price (price):", first.find('[data-testid="price"]').text().trim());
            console.log("Link (thumbnail-link):", first.find('[data-testid="thumbnail-link"]').attr('href'));

            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(process.cwd(), 'first_item.html');
            fs.writeFileSync(filePath, first.html() || '');
            console.log(`\nSaved first item HTML to ${filePath}`);
        } else {
            // Try different item wrapper if li[data-testid="item-cell"] failed
            const altItems = $('[data-testid="item-cell"]');
            console.log(`Found ${altItems.length} items with [data-testid="item-cell"]`);
            if (altItems.length > 0) {
                const first = altItems.first();
                console.log("Title (thumbnail-item-name):", first.find('[data-testid="thumbnail-item-name"]').text().trim());
                console.log("Price (price):", first.find('[data-testid="price"]').text().trim());
                console.log("Link:", first.attr('href') || first.find('a').attr('href'));

                const fs = require('fs');
                fs.writeFileSync('first_item.html', first.html() || '');
                console.log("\nSaved first item HTML to first_item.html");
            }
        }
    } catch (error) {
        console.error("Error during analysis:", error);
    }
}

analyze();
