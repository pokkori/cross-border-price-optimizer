import { OptimizeListingInput, OptimizeListingOutput, CompetitorPrice, OverseasPlatform } from './types';

async function runOptimizeListingTest() {
    console.log("--- Starting Optimize Listing API Test ---");

    const testInput: OptimizeListingInput = {
        productSku: 'GADGET-XYZ-001',
        productTitleJP: '最新型ガジェットXYZ',
        productDescriptionJP: '2026年最新モデルの高性能ガジェットです。革新的な機能とデザインを兼ね備えています。コレクター必見の逸品！',
        productCategory: 'Electronics',
        currentCompetitorPrices: [
            { platform: 'eBay', price: 85.00, currency: 'USD', listingUrl: 'https://ebay.com/item1' },
            { platform: 'eBay', price: 88.50, currency: 'USD', listingUrl: 'https://ebay.com/item2' },
            { platform: 'StockX', price: 92.00, currency: 'USD', listingUrl: 'https://stockx.com/item3' },
        ] as CompetitorPrice[], // Cast to ensure type safety
        targetOverseasPlatform: 'eBay' as OverseasPlatform,
        destinationCountryCode: 'US',
        minProfitMarginPercentage: 0.10, // 10% minimum profit margin
    };

    try {
        // Assuming Next.js development server is running on port 3000
        const response = await fetch('http://localhost:3000/api/optimizeListing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testInput),
        });

        const data: OptimizeListingOutput | { error: string } = await response.json();

        if (response.ok) {
            const output = data as OptimizeListingOutput;
            console.log(`
--- Optimize Listing API Response (Success) ---`);
            console.log(`Optimized Selling Price (${output.currency}): ${output.optimizedSellingPrice.toFixed(2)}`);
            console.log(`Optimized Selling Price (JPY Equivalent): ${output.optimizedSellingPriceJPYEquivalent.toFixed(2)}`);
            console.log(`Pricing Strategy: ${output.pricingStrategyUsed}`);
            console.log(`
--- AI Generated English Description ---`);
            console.log(output.optimizedEnglishDescription);
            console.log(`
--- Profit Calculation Details (JPY) ---`);
            console.log(`  Domestic Purchase Price: ${output.profitCalculationDetails.domesticPurchasePriceJPY.toFixed(2)}`);
            console.log(`  Overseas Selling Price (converted): ${output.profitCalculationDetails.overseasSellingPriceJPY.toFixed(2)}`);
            console.log(`  International Shipping Cost: ${output.profitCalculationDetails.internationalShippingCostJPY.toFixed(2)}`);
            console.log(`  Customs Duty: ${output.profitCalculationDetails.customsDutyJPY.toFixed(2)}`);
            console.log(`  Domestic Platform Fee: ${output.profitCalculationDetails.domesticPlatformFeeJPY.toFixed(2)}`);
            console.log(`  Overseas Platform Fee: ${output.profitCalculationDetails.overseasPlatformFeeJPY.toFixed(2)}`);
            console.log(`  Estimated Profit: ${output.profitCalculationDetails.estimatedProfitJPY.toFixed(2)}`);
            console.log("-----------------------------------------");
        } else {
            const errorOutput = data as { error: string };
            console.error(`
--- Optimize Listing API Response (Error) ---`);
            console.error("Status:", response.status);
            console.error("Error Message:", errorOutput.error);
        }

    } catch (error: any) {
        console.error("Failed to connect to Optimize Listing API:", error.message);
        console.error("Please ensure your Next.js development server is running on http://localhost:3000.");
    }
    console.log(`
--- Optimize Listing API Test Finished ---`);
}

runOptimizeListingTest();
