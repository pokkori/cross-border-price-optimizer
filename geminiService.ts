import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ProfitCalculationError } from './types';

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
