import {
    ProfitCalculationInput,
    CalculatedProfitDetails,
    ProfitCalculationError
} from './types';
import {
    getProductBySku,
    getPlatform,
    getShippingCost,
    getCustomsDuty,
    getExchangeRate
} from './dbService';

export async function calculateProfit(
    input: ProfitCalculationInput
): Promise<CalculatedProfitDetails> {
    const { productSku, domesticPlatform, overseasPlatform, destinationCountryCode, targetSellingPriceOverseas } = input;

    // --- 1. Fetch Product Metadata ---
    const product = await getProductBySku(productSku);
    if (!product) {
        throw new ProfitCalculationError(`Product with SKU ${productSku} not found.`);
    }
    if (!product.weight_kg || !product.hs_code) {
        throw new ProfitCalculationError(`Product ${productSku} is missing essential data (weight_kg or hs_code) for profit calculation.`);
    }

    // --- 2. Determine Domestic Purchase Price ---
    // Priority: manualDomesticPrice > product.purchase_price from DB
    let domesticPurchasePriceJPY: number;
    if (input.manualDomesticPrice !== undefined) {
        domesticPurchasePriceJPY = input.manualDomesticPrice;
    } else if (product.purchase_price !== undefined && product.purchase_price !== null) {
        domesticPurchasePriceJPY = product.purchase_price;
    } else {
        throw new ProfitCalculationError(
            `No domestic purchase price available for ${productSku}. Provide manualDomesticPrice or set purchase_price in DB.`
        );
    }

    if (domesticPurchasePriceJPY <= 0) {
        throw new ProfitCalculationError(`Invalid domestic purchase price (${domesticPurchasePriceJPY}) for ${productSku}.`);
    }

    // --- 3. Fetch Overseas Selling Price and Platform Details ---
    let overseasSellingPriceLocalCurrency: number;
    let overseasPlatformCurrency: string;

    const overseasPlatformDetails = await getPlatform(overseasPlatform);
    if (!overseasPlatformDetails) {
        throw new ProfitCalculationError(`Overseas platform ${overseasPlatform} not found in DB.`);
    }
    overseasPlatformCurrency = overseasPlatformDetails.currency;

    overseasSellingPriceLocalCurrency = targetSellingPriceOverseas;

    if (overseasSellingPriceLocalCurrency <= 0) {
        throw new ProfitCalculationError(`Invalid overseas selling price (${overseasSellingPriceLocalCurrency}) from ${overseasPlatform} for ${productSku}.`);
    }

    // --- 4. Fetch Exchange Rate (from Overseas Platform Currency to JPY) ---
    let exchangeRate: number;
    if (overseasPlatformCurrency === 'JPY') {
        exchangeRate = 1;
    } else {
        const fetchedRate = await getExchangeRate(overseasPlatformCurrency, 'JPY');
        if (!fetchedRate || fetchedRate.rate <= 0) {
            throw new ProfitCalculationError(
                `Exchange rate from ${overseasPlatformCurrency} to JPY not found in DB.`
            );
        }
        exchangeRate = fetchedRate.rate;
    }
    const overseasSellingPriceJPY = overseasSellingPriceLocalCurrency * exchangeRate;

    // --- 5. Calculate International Shipping Cost ---
    const internationalShippingCostJPY = await getShippingCost(
        product.weight_kg,
        destinationCountryCode
    );

    // --- 6. Calculate Platform Fees ---
    const domesticPlatformDetails = await getPlatform(domesticPlatform);
    if (!domesticPlatformDetails) {
        throw new ProfitCalculationError(`Domestic platform ${domesticPlatform} not found in DB.`);
    }
    const domesticPlatformFeeJPY = domesticPurchasePriceJPY * domesticPlatformDetails.base_fee_percentage;

    const overseasPlatformFeeJPY = overseasSellingPriceJPY * overseasPlatformDetails.base_fee_percentage;

    // --- 7. Calculate Customs Duty ---
    const usdToJpyRate = await getExchangeRate('USD', 'JPY');
    if (!usdToJpyRate || usdToJpyRate.rate <= 0) {
        throw new ProfitCalculationError("Exchange rate USD to JPY not available for customs duty calculation.");
    }
    const overseasSellingPriceUSD = overseasSellingPriceJPY / usdToJpyRate.rate;

    const customsDutyPercentage = await getCustomsDuty(
        product.hs_code,
        destinationCountryCode,
        overseasSellingPriceUSD
    );
    const customsDutyJPY = overseasSellingPriceJPY * customsDutyPercentage;

    // --- 8. Calculate Total Profit ---
    const totalCostJPY = domesticPurchasePriceJPY + internationalShippingCostJPY + customsDutyJPY + domesticPlatformFeeJPY + overseasPlatformFeeJPY;
    const estimatedProfitJPY = overseasSellingPriceJPY - totalCostJPY;
    const profitMargin = overseasSellingPriceJPY > 0
        ? estimatedProfitJPY / overseasSellingPriceJPY
        : 0;

    return {
        estimatedProfitJPY,
        profitMargin,
        domesticPurchasePriceJPY,
        overseasSellingPriceLocalCurrency,
        overseasSellingPriceJPY,
        exchangeRate,
        internationalShippingCostJPY,
        customsDutyJPY,
        domesticPlatformFeeJPY,
        overseasPlatformFeeJPY,
    };
}
