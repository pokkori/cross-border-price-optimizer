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

/**
 * Amazonはカテゴリによって手数料率が異なるため、商品カテゴリで動的に決定する。
 * 参考: https://sell.amazon.com/fees (2024年時点)
 */
export function getAmazonFeePercentage(category?: string): number {
    if (!category) return 0.15;
    const cat = category.toLowerCase();
    if (cat.includes('electronics') || cat.includes('電子') || cat.includes('camera')) return 0.08;
    if (cat.includes('jewelry') || cat.includes('ジュエリー') || cat.includes('宝飾')) return 0.20;
    if (cat.includes('shoes') || cat.includes('靴') || cat.includes('footwear')) return 0.15;
    if (cat.includes('clothing') || cat.includes('apparel') || cat.includes('fashion') ||
        cat.includes('衣類') || cat.includes('アパレル') || cat.includes('ファッション')) return 0.17;
    if (cat.includes('book') || cat.includes('本') || cat.includes('書籍')) return 0.15;
    if (cat.includes('beauty') || cat.includes('美容') || cat.includes('cosmetic')) return 0.08;
    if (cat.includes('sports') || cat.includes('スポーツ') || cat.includes('outdoor')) return 0.15;
    if (cat.includes('toy') || cat.includes('おもちゃ') || cat.includes('game') || cat.includes('ゲーム')) return 0.15;
    if (cat.includes('watch') || cat.includes('時計')) return 0.16;
    return 0.15; // デフォルト
}

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
    // 国内プラットフォームでは「買い手」として仕入れるため手数料は発生しない。
    // 手数料は出品者（売り手）側が負担するものであり、仕入れ価格にすでに反映済み。
    await getPlatform(domesticPlatform); // 存在確認のみ
    const domesticPlatformFeeJPY = 0;

    // 海外プラットフォーム手数料: 料率 × 売価 + 固定手数料（eBay $0.30/件など）
    let overseasFeePercentage = overseasPlatformDetails.base_fee_percentage;
    if (overseasPlatform === 'Amazon') {
        // Amazonはカテゴリ依存のため商品カテゴリで上書き
        overseasFeePercentage = getAmazonFeePercentage(product.category);
    }
    const overseasPercentageFeeJPY = overseasSellingPriceJPY * overseasFeePercentage;
    const overseasFixedFeeJPY = (overseasPlatformDetails.fixed_fee_local_currency ?? 0) * exchangeRate;
    const overseasPlatformFeeJPY = overseasPercentageFeeJPY + overseasFixedFeeJPY;

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
