import { NextResponse } from 'next/server';
import { OptimizeListingInput, OptimizeListingOutput, ProfitCalculationError, DomesticPlatform } from '../../../types'; // Adjust path as needed
import { generateEnglishDescription } from '../../../geminiService'; // Adjust path as needed
import { determineOptimalSellingPrice } from '../../../priceOptimization'; // Adjust path as needed
import { getExchangeRate } from '../../../dbService'; // Adjust path as needed

// SupabaseやNode APIを使うため Node.js ランタイムを明示
export const runtime = 'nodejs';

// Define a POST handler for the API route
export async function POST(request: Request) {
    try {
        const input: OptimizeListingInput = await request.json();

        const {
            productSku,
            productTitleJP,
            productDescriptionJP,
            productCategory,
            currentCompetitorPrices,
            domesticPlatform: inputDomesticPlatform,
            targetOverseasPlatform,
            destinationCountryCode,
            minProfitMarginPercentage
        } = input;

        // --- 入力バリデーション ---
        const missingFields: string[] = [];
        if (!productSku) missingFields.push('productSku');
        if (!productTitleJP) missingFields.push('productTitleJP');
        if (!productDescriptionJP) missingFields.push('productDescriptionJP');
        if (!productCategory) missingFields.push('productCategory');
        if (!currentCompetitorPrices || !Array.isArray(currentCompetitorPrices)) missingFields.push('currentCompetitorPrices');
        if (!targetOverseasPlatform) missingFields.push('targetOverseasPlatform');
        if (!destinationCountryCode) missingFields.push('destinationCountryCode');

        if (missingFields.length > 0) {
            return NextResponse.json(
                { error: `必須項目が不足しています: ${missingFields.join(', ')}` },
                { status: 400 }
            );
        }

        // --- 1. Generate Optimized English Description (AI Rewrite) ---
        const optimizedEnglishDescription = await generateEnglishDescription(
            productTitleJP,
            productDescriptionJP,
            productCategory
        );

        // --- 2. Determine Optimal Selling Price ---
        const domesticPlatform: DomesticPlatform = inputDomesticPlatform ?? 'Mercari';

        const {
            optimalPrice,
            strategy,
            profitDetails
        } = await determineOptimalSellingPrice(
            productSku,
            domesticPlatform,
            targetOverseasPlatform,
            destinationCountryCode,
            currentCompetitorPrices,
            minProfitMarginPercentage
        );

        if (optimalPrice === null || !profitDetails) {
            throw new ProfitCalculationError("Could not determine optimal price or profit details.");
        }

        // --- 3. Convert optimal price to JPY equivalent for output/logging ---
        let overseasPlatformCurrency: string;
        if (targetOverseasPlatform === 'eBay' || targetOverseasPlatform === 'StockX') {
            overseasPlatformCurrency = 'USD';
        } else {
            throw new ProfitCalculationError(`Unsupported overseas platform: ${targetOverseasPlatform}`);
        }

        const overseasToJpyRate = await getExchangeRate(overseasPlatformCurrency, 'JPY');
        if (!overseasToJpyRate || overseasToJpyRate.rate <= 0) {
            throw new ProfitCalculationError(`Exchange rate from ${overseasPlatformCurrency} to JPY not found or invalid.`);
        }
        const optimizedSellingPriceJPYEquivalent = optimalPrice * overseasToJpyRate.rate;

        const output: OptimizeListingOutput = {
            optimizedSellingPrice: optimalPrice,
            optimizedSellingPriceJPYEquivalent: optimizedSellingPriceJPYEquivalent,
            optimizedEnglishDescription: optimizedEnglishDescription,
            currency: overseasPlatformCurrency,
            profitCalculationDetails: profitDetails,
            pricingStrategyUsed: strategy,
        };

        return NextResponse.json(output);

    } catch (error: any) {
        console.error("API Error in optimizeListing:", error);
        return NextResponse.json(
            { error: error.message || "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
