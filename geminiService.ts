import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ProfitCalculationError } from './types';
import type { DemandAnalysisInput, OverseasDemandAnalysis } from './types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY';

if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
    console.warn("GEMINI_API_KEY is not set. Gemini API calls will be mocked.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Using 1.5-flash for better stability/quota

const safetySettings: any[] = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    },
];

/**
 * Generates an English product description using the Gemini AI, tailored for overseas markets.
 */
export async function generateEnglishDescription(
    productTitleJP: string,
    productDescriptionJP: string,
    productCategory: string
): Promise<string> {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || GEMINI_API_KEY.includes('your_gemini_api_key')) {
        console.warn("[GeminiService] Mocking AI description generation due to missing or placeholder API key.");
        return `[MOCKED AI DESCRIPTION for ${productTitleJP} (Category: ${productCategory})]: This is a fantastic item for collectors! It's in great condition and highly sought after in the 2026 market. Don't miss out on this rare opportunity to own a piece of history. Perfect for ${productCategory} enthusiasts.`;
    }

    const promptTemplate = (title: string, description: string, category: string) => `
    You are an expert e-commerce marketing copywriter specializing in cross-border sales from Japan to English-speaking markets (like the US and Europe).
    Your task is to rewrite a Japanese product title and description into an appealing, native-level English description.
    Focus on creating content that resonates with overseas collectors and enthusiasts, incorporating keywords and trends from the 2026 market context.
    Do NOT just translate. Infuse marketing language, highlight unique selling points, rarity, condition (if applicable), and cultural significance if relevant.
    Maintain a friendly, enthusiastic, and professional tone.
    The output should be solely the rewritten English description, ready for an e-commerce listing.

    ---
    Product Category: ${category}
    Japanese Title: ${title}
    Japanese Description: ${description}
    ---

    Rewritten English Description:
    `;

    const prompt = promptTemplate(productTitleJP, productDescriptionJP, productCategory);

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            safetySettings,
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 60,
                maxOutputTokens: 500,
            },
        });

        const response = result.response;
        const text = response.text();
        return text.trim();
    } catch (error: any) {
        console.error("[GeminiService] Error generating English description:", error.message);
        // Fallback: return the original title if AI fails, so the workflow can continue
        console.warn("[GeminiService] Falling back to Japanese title due to API error.");
        return `[Translation Pending] ${productTitleJP}`;
    }
}

/**
 * 商品リストの海外需要をGemini AIでバッチ分析する。
 * 海外コレクター市場で即売れする「隠れた価値がある商品」を検出する。
 */
export async function analyzeOverseasDemandBatch(
    listings: DemandAnalysisInput[]
): Promise<OverseasDemandAnalysis[]> {
    const fallback = (): OverseasDemandAnalysis[] =>
        listings.map(() => ({ score: 0, isInstantSellCandidate: false, demandCategory: null, reasoning: 'AI分析スキップ' }));

    if (listings.length === 0) return [];
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY' || GEMINI_API_KEY.includes('your_gemini_api_key')) {
        console.warn("[GeminiService] 需要分析スキップ: GEMINI_API_KEY 未設定");
        return fallback();
    }

    const prompt = `You are an expert in Japanese cross-border e-commerce arbitrage identifying Japanese domestic
items that sell instantly at premium prices overseas (eBay, US/Europe).

Analyze each listing below. Return ONLY a valid JSON array — no markdown, no explanation.
One object per listing, same order as input.

## Known high-demand categories from Japan:
1. フィルムカメラ: Olympus OM/Pen, Canon AE-1/F-1, Nikon FM2/F3, Minolta X-700, Konica,
   Yashica, Pentax K/MX. Even "junk" bodies sell overseas.
2. レトロゲーム: Famicom, Super Famicom, Game Boy (all), PC-Engine, Mega Drive, Neo Geo.
   Original carts, boxed sets, accessories.
3. ウォークマン: Sony WM-series, portable cassette players, cassette decks.
4. ヴィンテージオーディオ: Pioneer/Kenwood/Sansui/Marantz amps, turntables, reel-to-reel.
5. 機械式時計: Seiko 5/Presage/vintage, Citizen, Orient — hand-wound/automatic, 1960s-80s.
6. アニメグッズ: First-edition manga, vintage figures, limited OP/DB/Gundam merchandise.
7. 鉄道模型: Kato/Tomix N-gauge, vintage brass models.
8. カメラレンズ: M42/Nikon-F/Canon-FD vintage lenses, Takumar series.
9. アーケード基板: JAMMA/CPS2/Neo Geo MVS PCBs.
10. 絶版プラモデル: Tamiya vintage kits, 初代ガンプラ, vintage scale models.

## Scoring (0-10):
- 8-10: Strong instant-sell. Clearly in a high-demand category. Sells within 24-48h on eBay.
- 5-7: Moderate demand. Some collector interest but not guaranteed instant sale.
- 3-4: Low demand. Limited overseas appeal.
- 0-2: No meaningful overseas demand.

## Output schema per item:
{
  "score": integer 0-10,
  "isInstantSellCandidate": boolean (score >= 7),
  "demandCategory": one of ["フィルムカメラ","レトロゲーム","ウォークマン","ヴィンテージオーディオ",
    "機械式時計","アニメグッズ","鉄道模型","カメラレンズ","アーケード基板","絶版プラモデル"] or null,
  "reasoning": string (one sentence Japanese, max 60 chars)
}

## Input listings:
${JSON.stringify(listings, null, 2)}`;

    try {
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            safetySettings,
            generationConfig: { temperature: 0.2, topP: 0.90, topK: 40, maxOutputTokens: 4096 },
        });
        const text = result.response.text().trim()
            .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(text) as OverseasDemandAnalysis[];

        if (!Array.isArray(parsed) || parsed.length !== listings.length) return fallback();

        return parsed.map(item => ({
            score: Math.min(10, Math.max(0, Math.round(Number(item.score) || 0))),
            isInstantSellCandidate: (item.score ?? 0) >= 7,
            demandCategory: item.demandCategory ?? null,
            reasoning: String(item.reasoning ?? '').slice(0, 80),
        }));
    } catch (e: any) {
        console.error('[GeminiService] 需要分析バッチ失敗:', e.message);
        return fallback();
    }
}
