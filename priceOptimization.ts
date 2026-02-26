import {
    CompetitorPrice,
    DomesticPlatform,
    OverseasPlatform,
    ProfitCalculationInput,
    ProfitCalculationError,
    CalculatedProfitDetails,
    Product
} from './types';
import { calculateProfit, getAmazonFeePercentage } from './profitCalculator';
import { getProductBySku, getExchangeRateLive, getPlatform, getCustomsDuty, getShippingCost } from './dbService';

/**
 * Finds the lowest competitor price for a given target currency.
 * @param competitorPrices Array of competitor price objects.
 * @param targetCurrency The currency to compare prices in (e.g., 'USD').
 * @returns The lowest price, or null if no relevant prices are found.
 */
function findLowestCompetitorPrice(
    competitorPrices: CompetitorPrice[],
    targetCurrency: string
): number | null {
    const relevantPrices = competitorPrices
        .filter(cp => cp.currency === targetCurrency && cp.price > 0)
        .map(cp => cp.price);

    return relevantPrices.length > 0 ? Math.min(...relevantPrices) : null;
}

/**
 * Calculates the minimum acceptable selling price in the target overseas currency
 * to ensure a minimum profit margin (or just covering costs).
 * This function will internally call calculateProfit to get the cost breakdown.
 * @param productSku The SKU of the product.
 * @param domesticPlatform The domestic platform where the product was bought.
 * @param targetOverseasPlatform The overseas platform where the product will be sold.
 * @param destinationCountryCode The country code for shipping/customs.
 * @param minProfitMarginPercentage The desired minimum profit margin (e.g., 0.10 for 10%).
 * @returns The minimum selling price in the overseas currency.
 */
export async function calculateMinSellingPrice(
    productSku: string,
    domesticPlatform: string,
    targetOverseasPlatform: OverseasPlatform,
    destinationCountryCode: string,
    minProfitMarginPercentage: number = 0.05,
    manualDomesticPrice?: number
): Promise<{ minSellingPriceLocalCurrency: number, profitDetails: CalculatedProfitDetails }> {
    const product = await getProductBySku(productSku);
    if (!product || !product.weight_kg || !product.hs_code) {
        throw new ProfitCalculationError(`Product ${productSku} details missing for minimum price calculation.`);
    }

    const domesticPurchasePriceJPY = manualDomesticPrice ?? product.purchase_price ?? 0;
    if (domesticPurchasePriceJPY <= 0) {
        throw new ProfitCalculationError(`Invalid domestic purchase price for ${productSku}.`);
    }

    // 1. 固定コストの計算 (販売価格に依存しないものをDB直接取得)
    const internationalShippingCostJPY = await getShippingCost(product.weight_kg!, destinationCountryCode);

    // 国内プラットフォームでは買い手として仕入れるため手数料は発生しない
    const domesticPlatformFeeJPY = 0;

    // 2. 変動率の取得 (海外プラットフォーム手数料率 + 関税率をDBから動的取得)
    const overseasPlatformDetails = await getPlatform(targetOverseasPlatform);

    // 海外手数料率: Amazonはカテゴリ依存、それ以外はDBから取得
    let overseasFeeRate = overseasPlatformDetails?.base_fee_percentage ?? 0.1290;
    if (targetOverseasPlatform === 'Amazon') {
        overseasFeeRate = getAmazonFeePercentage(product.category);
    }

    // eBayなど固定手数料がある場合はJPY換算して固定費に加算
    const jpyToOverseasRateForFixed = await getExchangeRateLive('JPY', overseasPlatformDetails?.currency ?? 'USD');
    const overseasToJpyRate = jpyToOverseasRateForFixed && jpyToOverseasRateForFixed.rate > 0
        ? 1 / jpyToOverseasRateForFixed.rate : 149;
    const fixedFeeJPY = (overseasPlatformDetails?.fixed_fee_local_currency ?? 0) * overseasToJpyRate;

    // 固定費 = 仕入価格 + 国際送料 + 海外プラットフォーム固定手数料
    const fixedCostsJPY = domesticPurchasePriceJPY +
        internationalShippingCostJPY +
        domesticPlatformFeeJPY +
        fixedFeeJPY;

    // 関税率はDBから動的取得（循環依存回避のため国内仕入価格をUSD換算して使用）
    const jpyToUsdRate = await getExchangeRateLive('JPY', 'USD');
    const estimatedValueUsd = domesticPurchasePriceJPY * (jpyToUsdRate?.rate ?? 0.0067);
    const estimatedDutyRate = product.hs_code
        ? await getCustomsDuty(product.hs_code, destinationCountryCode, estimatedValueUsd)
        : 0;

    // 3. 逆算による必要売価の算出（精密逆算アルゴリズム）
    // SellingPriceJPY = (FixedCosts + SellingPriceJPY * (FeeRate + DutyRate)) * (1 + MarginRate)
    // SellingPriceJPY * (1 - (FeeRate + DutyRate) * (1 + MarginRate)) = FixedCosts * (1 + MarginRate)

    const marginMultiplier = 1 + minProfitMarginPercentage;
    const denominator = 1 - (overseasFeeRate + estimatedDutyRate) * marginMultiplier;

    let requiredSellingPriceJPY: number;
    if (denominator <= 0) {
        // マージンが高すぎるか手数料が高すぎる場合、安全なフォールバック
        requiredSellingPriceJPY = fixedCostsJPY * 2;
    } else {
        requiredSellingPriceJPY = (fixedCostsJPY * marginMultiplier) / denominator;
    }

    // 4. 外貨換算（プラットフォーム通貨に基づき動的取得）
    const overseasPlatformInfo = await getPlatform(targetOverseasPlatform);
    const targetCurrency = overseasPlatformInfo?.currency ?? 'USD';
    const jpyToOverseasRate = await getExchangeRateLive('JPY', targetCurrency);
    if (!jpyToOverseasRate || jpyToOverseasRate.rate <= 0) {
        throw new ProfitCalculationError(`Exchange rate from JPY to ${targetCurrency} not found.`);
    }
    const minSellingPriceLocalCurrency = requiredSellingPriceJPY * jpyToOverseasRate.rate;

    // 5. 最終的な利益詳細の再計算
    const finalProfitDetails = await calculateProfit({
        productSku,
        domesticPlatform: domesticPlatform as DomesticPlatform,
        overseasPlatform: targetOverseasPlatform,
        destinationCountryCode,
        targetSellingPriceOverseas: minSellingPriceLocalCurrency,
        manualDomesticPrice: domesticPurchasePriceJPY
    });

    return {
        minSellingPriceLocalCurrency: parseFloat(minSellingPriceLocalCurrency.toFixed(2)),
        profitDetails: finalProfitDetails
    };
}


/**
 * Determines the optimal selling price for a product based on competitor prices and minimum profit.
 * @param productSku The SKU of the product.
 * @param domesticPlatform The domestic platform for cost calculation.
 * @param overseasPlatform The overseas platform for selling.
 * @param destinationCountryCode The destination country for shipping/customs.
 * @param competitorPrices Array of current competitor prices.
 * @param defaultMinProfitMarginPercentage Default minimum profit margin.
 * @returns The optimal selling price in the overseas platform's currency, and the pricing strategy used.
 */
export async function determineOptimalSellingPrice(
    productSku: string,
    domesticPlatform: string,
    overseasPlatform: OverseasPlatform,
    destinationCountryCode: string,
    competitorPrices: CompetitorPrice[],
    defaultMinProfitMarginPercentage: number = 0.05,
    manualDomesticPrice?: number // Added
): Promise<{ optimalPrice: number | null; strategy: string; profitDetails: CalculatedProfitDetails | null }> {

    let overseasPlatformCurrency: string;
    if (overseasPlatform === 'eBay' || overseasPlatform === 'StockX' || overseasPlatform === 'Amazon' || overseasPlatform === 'Mercari US') {
        overseasPlatformCurrency = 'USD';
    } else {
        throw new ProfitCalculationError(`Unsupported overseas platform: ${overseasPlatform}`);
    }

    const lowestCompetitorPrice = findLowestCompetitorPrice(competitorPrices, overseasPlatformCurrency);

    const { minSellingPriceLocalCurrency, profitDetails } = await calculateMinSellingPrice(
        productSku,
        domesticPlatform,
        overseasPlatform,
        destinationCountryCode,
        defaultMinProfitMarginPercentage,
        manualDomesticPrice // Passed
    );

    let optimalPrice: number | null = null;
    let strategy = "Unknown";

    if (lowestCompetitorPrice !== null) {
        // Strategy 1: Undercut lowest competitor
        const potentialPrice = lowestCompetitorPrice - 0.01; // 1 cent cheaper

        if (potentialPrice >= minSellingPriceLocalCurrency) {
            optimalPrice = potentialPrice;
            strategy = "UndercutLowestCompetitor";
        } else {
            // Strategy 2: Cannot undercut, maintain minimum profit or stop listing
            optimalPrice = minSellingPriceLocalCurrency;
            strategy = "MaintainMinProfit"; // Or "StopListing" if profit is too low
            console.warn(`[PriceOptimization] Cannot undercut competitor (${lowestCompetitorPrice} ${overseasPlatformCurrency}) while maintaining min profit. Setting price to min profit level (${minSellingPriceLocalCurrency} ${overseasPlatformCurrency}).`);
        }
    } else {
        // No competitors found, set price to minimum profit level
        optimalPrice = minSellingPriceLocalCurrency;
        strategy = "NoCompetitorsFound_MaintainMinProfit";
        console.log(`[PriceOptimization] No competitors found. Setting price to minimum profit level (${minSellingPriceLocalCurrency} ${overseasPlatformCurrency}).`);
    }

    return { optimalPrice, strategy, profitDetails };
}
