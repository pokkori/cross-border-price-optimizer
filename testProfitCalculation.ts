import { calculateProfit } from './profitCalculator';
import { ProfitCalculationInput } from './types';

async function runTest() {
    console.log("--- Starting Profit Calculation Test ---");

    const testInput: ProfitCalculationInput = {
        productSku: 'GADGET-XYZ-001',
        domesticPlatform: 'Mercari',
        overseasPlatform: 'eBay',
        destinationCountryCode: 'US',
        targetSellingPriceOverseas: 90, // USD
    };

    try {
        const result = await calculateProfit(testInput);

        console.log(`
--- Estimated Profit for Product A (GADGET-XYZ-001) ---`);
        console.log(`Domestic Purchase Price (JPY): ${result.domesticPurchasePriceJPY.toFixed(2)}`);
        console.log(`Overseas Selling Price (${testInput.overseasPlatform === 'eBay' ? 'USD' : 'EUR'}): ${result.overseasSellingPriceLocalCurrency.toFixed(2)}`);
        console.log(`Overseas Selling Price (JPY equivalent): ${result.overseasSellingPriceJPY.toFixed(2)}`);
        console.log(`Exchange Rate (1 ${testInput.overseasPlatform === 'eBay' ? 'USD' : 'EUR'} = ${result.exchangeRate.toFixed(4)} JPY):`); // Fixed currency to USD for eBay
        console.log(`International Shipping Cost (JPY): ${result.internationalShippingCostJPY.toFixed(2)}`);
        console.log(`Customs Duty (JPY): ${result.customsDutyJPY.toFixed(2)}`);
        console.log(`Domestic Platform Fee (JPY): ${result.domesticPlatformFeeJPY.toFixed(2)}`);
        console.log(`Overseas Platform Fee (JPY): ${result.overseasPlatformFeeJPY.toFixed(2)}`);
        console.log("-----------------------------------------");
        console.log(`Total Estimated Profit (JPY): ${result.estimatedProfitJPY.toFixed(2)}`);
        console.log("-----------------------------------------");

    } catch (error: any) {
        console.error("Profit Calculation Error:", error.message);
    }
    console.log(`
--- Profit Calculation Test Finished ---`);
}

runTest();
