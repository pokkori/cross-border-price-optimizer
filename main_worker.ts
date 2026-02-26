import { scrapeMercari } from './mercariScraper';
import { scrapeRakuma } from './rakumaScraper';
import { scrapePayPayFleamarket } from './paypayFleamarketScraper';
import { fetchStockXPricesWithSource } from './stockxScraper';
import { fetchMercariUsPricesWithSource } from './mercariUsScraper';
import { determineOptimalSellingPrice } from './priceOptimization';
import { generateEnglishDescription } from './geminiService';
import { Notifier } from './notifierService';
import { ProfitCalculationError, MarketPriceItem, CalculatedProfitDetails, OverseasPlatform } from './types';
import { getProductBySku, getPlatform, getExchangeRate, upsertMarketPrice, insertActivityLog, insertNotificationLog, getRecentNotification, getCompetitorPrices } from './dbService';

const notifier = new Notifier();

// 通知・ログに含めるダッシュボードのベースURL（本番では Vercel の URL 等を指定）
const DASHBOARD_BASE_URL = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000';

// 通知関連の設定値（環境変数で上書き可能）
const MIN_PROFIT_MARGIN_FOR_NOTIFICATION =
    process.env.MIN_PROFIT_MARGIN_FOR_NOTIFICATION
        ? Number(process.env.MIN_PROFIT_MARGIN_FOR_NOTIFICATION)
        : 0.20; // デフォルト20%

const MIN_PROFIT_AMOUNT_FOR_NOTIFICATION_JPY =
    process.env.MIN_PROFIT_AMOUNT_FOR_NOTIFICATION_JPY
        ? Number(process.env.MIN_PROFIT_AMOUNT_FOR_NOTIFICATION_JPY)
        : 0; // デフォルトは金額条件なし

const MAX_NOTIFICATIONS_PER_RUN =
    process.env.MAX_NOTIFICATIONS_PER_RUN
        ? Number(process.env.MAX_NOTIFICATIONS_PER_RUN)
        : Infinity; // デフォルト無制限（従来挙動）

// 'immediate' | 'summary'
const NOTIFICATION_MODE =
    (process.env.NOTIFICATION_MODE as 'immediate' | 'summary' | undefined) || 'immediate';

const SUMMARY_TOP_N =
    process.env.SUMMARY_TOP_N
        ? Number(process.env.SUMMARY_TOP_N)
        : 3;

const NOTIFICATION_COOLDOWN_HOURS = 24;

// Failure tracking (in-memory for now)
const FAILURE_TRACKING_TABLE: { [workflowName: string]: { consecutiveFailures: number } } = {};
const MAX_CONSECUTIVE_FAILURES = 3;

interface WorkflowLog {
    workflowName: string;
    status: 'success' | 'failure' | 'skipped' | 'started' | 'finished' | 'emergency';
    message: string;
    productSku?: string;
    details?: any;
}

async function logActivity(log: WorkflowLog) {
    console.log(`[ACTIVITY_LOG] Workflow: ${log.workflowName}, Status: ${log.status}, Message: ${log.message}`);
    await insertActivityLog({
        timestamp: new Date().toISOString(),
        workflow_name: log.workflowName,
        status: log.status,
        message: log.message,
        product_sku: log.productSku,
        details: log.details,
        created_at: new Date().toISOString(),
    });
}

async function getConsecutiveFailureCount(workflowName: string): Promise<number> {
    return FAILURE_TRACKING_TABLE[workflowName]?.consecutiveFailures || 0;
}

async function incrementConsecutiveFailureCount(workflowName: string): Promise<void> {
    if (!FAILURE_TRACKING_TABLE[workflowName]) {
        FAILURE_TRACKING_TABLE[workflowName] = { consecutiveFailures: 0 };
    }
    FAILURE_TRACKING_TABLE[workflowName].consecutiveFailures++;
}

async function resetConsecutiveFailureCount(workflowName: string): Promise<void> {
    if (FAILURE_TRACKING_TABLE[workflowName]) {
        FAILURE_TRACKING_TABLE[workflowName].consecutiveFailures = 0;
    }
}

async function hasBeenNotifiedRecently(productSku: string, platform: OverseasPlatform): Promise<boolean> {
    return await getRecentNotification(productSku, platform, NOTIFICATION_COOLDOWN_HOURS);
}

async function recordNotification(options: {
    productSku: string;
    platform: OverseasPlatform;
    notifiedPrice: number;
    notifiedProfitMargin: number;
    notificationMethod: string;
    message: string;
    dashboardLink: string;
}) {
    await insertNotificationLog({
        timestamp: new Date().toISOString(),
        product_sku: options.productSku,
        platform: options.platform,
        notified_price: options.notifiedPrice,
        notified_profit_margin: options.notifiedProfitMargin,
        notification_method: options.notificationMethod,
        message: options.message,
        dashboard_link: options.dashboardLink,
        created_at: new Date().toISOString(),
    });
}

export async function mainWorkflow(keywords: string[], defaultMinProfitMargin: number = 0.10, productSku?: string, keywordSkuMap?: Record<string, string>) {
    const workflowName = 'main_product_scan';
    let overallWorkflowSuccess = true;
    const allProcessedItems: any[] = [];

    // サマリーモード用バッファ
    const summaryCandidates: {
        listing: MarketPriceItem;
        profitMargin: number;
        profitDetails: CalculatedProfitDetails;
        optimalPrice: number;
        dashboardLink: string;
        productSku: string;
    }[] = [];
    let notificationsSentThisRun = 0;

    try {
        await logActivity({ workflowName, status: 'started', message: 'Workflow started.' });
        console.log(`[main_worker] Running main workflow with keywords: ${keywords.join(', ')}`);

        for (const keyword of keywords) {
            let keywordProcessingSuccess = true;
            // キーワードごとにSKUを決定: keywordSkuMap > productSku > null
            const skuForKeyword = keywordSkuMap?.[keyword] ?? productSku ?? null;

            try {
                console.log(`[main_worker] Scraping Mercari for "${keyword}" (SKU: ${skuForKeyword || 'auto'})...`);
                const mercariListings: MarketPriceItem[] = await scrapeMercari(keyword);
                await logActivity({ workflowName, productSku: keyword, status: 'success', message: `Scraped ${mercariListings.length} items from Mercari for "${keyword}".` });

                for (const listing of mercariListings) {
                    let listingProcessingSuccess = true;

                    try {
                        const mercariPlatform = await getPlatform('Mercari');
                        if (!mercariPlatform) {
                            throw new ProfitCalculationError('Mercariプラットフォーム情報がDBに見つかりません。');
                        }

                        // SKUが指定されていない場合、市場価格データのみ保存してスキップ
                        const product = skuForKeyword ? await getProductBySku(skuForKeyword) : null;

                        if (!skuForKeyword || !product) {
                            // SKU未指定またはDB未登録: 市場価格のみ保存
                            const marketPriceData = {
                                product_sku: null,
                                platform_id: mercariPlatform.id,
                                listing_id: listing.listingId,
                                title: listing.title,
                                price: listing.price,
                                currency: listing.currency,
                                condition: listing.condition,
                                listing_url: listing.listingUrl,
                                image_url: listing.imageUrl,
                                data_source: listing.dataSource,
                                search_keyword: keyword,
                                scraped_at: listing.scrapedAt,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            };
                            await upsertMarketPrice(marketPriceData);
                            allProcessedItems.push(marketPriceData);
                            await logActivity({ workflowName, productSku: listing.listingId, status: 'skipped', message: `Market price saved without optimization (no matching SKU): ${listing.title}` });
                            continue;
                        }

                        // 競合価格をDBから取得（過去のスクレイピング結果）
                        const competitorPrices = await getCompetitorPrices(skuForKeyword, 'eBay');

                        let optimizedEnglishDescription: string;
                        let optimalPriceResult: { optimalPrice: number | null; strategy: string; profitDetails: CalculatedProfitDetails | null };

                        optimizedEnglishDescription = await generateEnglishDescription(
                            listing.title,
                            product.description || listing.title,
                            product.category || 'Unknown'
                        );
                        await logActivity({ workflowName, productSku: skuForKeyword, status: 'success', message: 'AI English description generated.' });

                        optimalPriceResult = await determineOptimalSellingPrice(
                            skuForKeyword,
                            'Mercari',
                            'eBay',
                            'US',
                            competitorPrices,
                            defaultMinProfitMargin,
                            listing.price
                        );
                        await logActivity({ workflowName, productSku: skuForKeyword, status: 'success', message: 'Optimal price determined.' });

                        const { optimalPrice, strategy, profitDetails } = optimalPriceResult;

                        if (optimalPrice === null || !profitDetails) {
                            throw new ProfitCalculationError("Could not determine optimal price or profit details for notification.");
                        }

                        const profitMargin = profitDetails.profitMargin;

                        const marketPriceData = {
                            product_sku: skuForKeyword,
                            platform_id: mercariPlatform.id,
                            listing_id: listing.listingId,
                            title: listing.title,
                            price: listing.price,
                            currency: listing.currency,
                            condition: listing.condition,
                            listing_url: listing.listingUrl,
                            image_url: listing.imageUrl,
                            optimized_english_description: optimizedEnglishDescription,
                            optimal_price: optimalPrice,
                            strategy,
                            profit_details: profitDetails,
                            profit_margin: profitMargin,
                            data_source: listing.dataSource,
                            search_keyword: keyword,
                            scraped_at: listing.scrapedAt,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                        };

                        await upsertMarketPrice(marketPriceData);
                        await logActivity({ workflowName, productSku: skuForKeyword, status: 'success', message: `Market price and analysis for ${listing.title} saved.` });

                        allProcessedItems.push({
                            ...marketPriceData,
                            optimizedEnglishDescription,
                            optimalPrice,
                            strategy,
                            profitDetails,
                            profitMargin
                        });

                        // --- 通知ロジック ---
                        const meetsMarginCondition = profitMargin >= MIN_PROFIT_MARGIN_FOR_NOTIFICATION;
                        const meetsAmountCondition = profitDetails.estimatedProfitJPY >= MIN_PROFIT_AMOUNT_FOR_NOTIFICATION_JPY;

                        if (meetsMarginCondition && meetsAmountCondition) {
                            const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(listing.title)}`;
                            const dashboardLink = `${DASHBOARD_BASE_URL}/dashboard?sku=${skuForKeyword}`;
                            const notificationMessage = `商品: ${listing.title} (${skuForKeyword})\n` +
                                `画像: ${listing.imageUrl || 'N/A'}\n` +
                                `メルカリURL: ${listing.listingUrl}\n` +
                                `eBay検索URL: ${ebaySearchUrl}\n` +
                                `推奨販売価格: ${optimalPrice.toFixed(2)} USD\n` +
                                `推定純利益: ${profitDetails.estimatedProfitJPY.toLocaleString()} JPY\n` +
                                `利益率: ${(profitMargin * 100).toFixed(2)}%`;

                            const alreadyNotified = await hasBeenNotifiedRecently(skuForKeyword, 'eBay');

                            if (!alreadyNotified && notificationsSentThisRun < MAX_NOTIFICATIONS_PER_RUN) {
                                if (NOTIFICATION_MODE === 'immediate') {
                                    await notifier.sendProfitNotification({
                                        productName: listing.title,
                                        estimatedProfit: profitDetails.estimatedProfitJPY,
                                        profitMargin: profitMargin,
                                        dashboardLink: dashboardLink,
                                        messagePrefix: '✨ 高利益商品発見! ✨'
                                    });
                                    notificationsSentThisRun++;

                                    await recordNotification({
                                        productSku: skuForKeyword,
                                        platform: 'eBay',
                                        notifiedPrice: optimalPrice,
                                        notifiedProfitMargin: profitMargin,
                                        notificationMethod: 'LINE/Slack',
                                        message: notificationMessage,
                                        dashboardLink,
                                    });
                                    await logActivity({ workflowName, productSku: productSku, status: 'success', message: 'High profit opportunity notified.' });
                                } else {
                                    // summary モードではいったんバッファに積む
                                    summaryCandidates.push({
                                        listing,
                                        profitMargin,
                                        profitDetails,
                                        optimalPrice,
                                        dashboardLink,
                                        productSku: skuForKeyword,
                                    });
                                }
                            }
                        }
                    } catch (listingError: any) {
                        listingProcessingSuccess = false;
                        await logActivity({ workflowName, productSku: listing.listingId, status: 'failure', message: `Listing processing failed: ${listingError.message}`, details: listingError });
                        console.error(`[main_worker] Error processing listing ${listing.listingId}:`, listingError.message);
                    }
                    if (!listingProcessingSuccess) {
                        keywordProcessingSuccess = false;
                    }
                }
            } catch (keywordError: any) {
                keywordProcessingSuccess = false;
                await logActivity({ workflowName, productSku: keyword, status: 'failure', message: `Keyword processing failed: ${keywordError.message}`, details: keywordError });
                console.error(`[main_worker] Error processing keyword "${keyword}":`, keywordError.message);
            }
            if (!keywordProcessingSuccess) {
                overallWorkflowSuccess = false;
            }
        }
    } catch (criticalError: any) {
        overallWorkflowSuccess = false;
        await logActivity({ workflowName, status: 'failure', message: `Critical workflow failure: ${criticalError.message}`, details: criticalError });
        console.error(`[main_worker] Critical workflow error:`, criticalError.message);
    } finally {
        if (overallWorkflowSuccess) {
            // サマリーモードの場合は、ここでまとめて通知を送信
            if (NOTIFICATION_MODE === 'summary' && summaryCandidates.length > 0 && MAX_NOTIFICATIONS_PER_RUN > 0) {
                // 利益率の高い順に並べ替え、上位N件のみ通知
                summaryCandidates.sort((a, b) => b.profitMargin - a.profitMargin);
                const topItems = summaryCandidates.slice(0, Math.min(SUMMARY_TOP_N, MAX_NOTIFICATIONS_PER_RUN));

                const lines: string[] = [];
                lines.push('✨ 高利益商品のサマリー ✨');
                topItems.forEach((item, index) => {
                    const { listing, profitDetails, profitMargin, optimalPrice, dashboardLink, productSku: itemSku } = item;
                    lines.push(
                        `\n#${index + 1} ${listing.title} (${itemSku})`,
                        `推奨販売価格: ${optimalPrice.toFixed(2)} USD`,
                        `推定純利益: ${profitDetails.estimatedProfitJPY.toLocaleString()} JPY`,
                        `利益率: ${(profitMargin * 100).toFixed(2)}%`,
                        `メルカリURL: ${listing.listingUrl}`,
                        `ダッシュボードで確認: ${dashboardLink}`,
                    );
                });

                const summaryMessage = lines.join('\n');
                await notifier.sendSummaryNotification(summaryMessage);

                // サマリーモードでも notification_logs に記録（重複通知防止のため）
                for (const item of topItems) {
                    await recordNotification({
                        productSku: item.productSku,
                        platform: 'eBay',
                        notifiedPrice: item.optimalPrice,
                        notifiedProfitMargin: item.profitMargin,
                        notificationMethod: 'LINE/Slack',
                        message: summaryMessage,
                        dashboardLink: item.dashboardLink,
                    });
                }

                await logActivity({ workflowName, status: 'success', message: `Summary notification sent for ${topItems.length} items.` });
            }

            await resetConsecutiveFailureCount(workflowName);
            await logActivity({ workflowName, status: 'finished', message: 'Workflow finished successfully.' });
        } else {
            await incrementConsecutiveFailureCount(workflowName);
            const currentFailures = await getConsecutiveFailureCount(workflowName);
            await logActivity({ workflowName, status: 'finished', message: `Workflow finished with failures. Consecutive failures: ${currentFailures}.` });

            if (currentFailures >= MAX_CONSECUTIVE_FAILURES) {
                await notifier.sendEmergencyNotification({
                    workflowName,
                    consecutiveFailures: currentFailures,
                    dashboardLink: `${DASHBOARD_BASE_URL}/dashboard`,
                });
                await logActivity({ workflowName, status: 'emergency', message: 'Emergency notification sent due to consecutive failures.' });
            }
        }
        console.log("[main_worker] Main workflow finished.");
    }
    return allProcessedItems;
}

// CLI execution: node main_worker.ts [--sku SKU] keyword1 keyword2 ...
if (require.main === module || (process.argv[1] && process.argv[1].includes('main_worker'))) {
    (async () => {
        const args = process.argv.slice(2);
        let sku = 'GADGET-XYZ-001';
        let keywords: string[] = [];

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--sku' && i + 1 < args.length) {
                sku = args[++i];
            } else {
                keywords.push(args[i]);
            }
        }
        if (keywords.length === 0) {
            keywords = ["任天堂スイッチ", "ポケモンカード"];
        }

        console.log(`[main_worker] Starting CLI workflow for SKU: ${sku || 'auto'}, keywords: ${keywords.join(', ')}`);
        await mainWorkflow(keywords, 0.10, sku || undefined);
    })();
}
