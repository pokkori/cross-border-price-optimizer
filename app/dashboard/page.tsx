'use client';

import { useState, useEffect, useMemo } from 'react';

// タグ種別
type ListingTag = 'none' | 'potential' | 'hold' | 'purchased';

// ダッシュボード表示用の商品インターフェース
interface DashboardProductListing {
    id: string;
    productSku: string;
    imageUrl: string;
    productTitleJP: string;
    productCategory: string;
    domesticPrice: number;
    overseasSellingPrice: {
        amount: number;
        currency: string;
    };
    estimatedNetProfitJPY: number;
    profitMarginPercentage: number;
    profitDetails?: {
        domesticPurchasePriceJPY: number;
        overseasSellingPriceJPY: number;
        internationalShippingCostJPY: number;
        domesticPlatformFeeJPY: number;
        overseasPlatformFeeJPY: number;
        customsDutyJPY: number;
        exchangeRate: number;
    };
    aiEnglishDescription: string;
    listingUrl: string;
    ebaySearchUrl: string;
    lastSynced: string;
    dataSource: 'scraped' | 'mock' | 'api';
    tag: ListingTag;
    note: string;
}

interface RecommendedProduct {
    keyword: string;
    title: string;
    // 最適国内ソース
    domesticPrice: number;
    domesticPlatform: string;
    domesticDataSource?: 'api' | 'scraped' | 'mock';
    domesticUrl: string;
    // 最適海外ソース
    overseasPrice: number;
    overseasPlatform: string;
    overseasDataSource?: 'api' | 'scraped' | 'mock';
    overseasSearchUrl: string;
    // 利益
    estimatedProfitJpy: number;
    profitMarginPercent: number;
    imageUrl: string;
    exchangeRate?: number;
    bestCombination: string;
    // 後方互換
    mercariPrice: number;
    ebayPriceUsd: number;
    mercariUrl: string;
    ebaySearchUrl: string;
    ebayDataSource?: 'api' | 'scraped' | 'mock';
    mercariDataSource?: 'api' | 'scraped' | 'mock';
    // Amazon情報
    amazonPriceUsd?: number;
    amazonDataSource?: 'api' | 'scraped' | 'mock';
    amazonSearchUrl?: string;
    // ヤフオク情報
    yahooPrice?: number;
    yahooDataSource?: 'api' | 'scraped' | 'mock';
    yahooUrl?: string;
    // ラクマ情報
    rakumaPrice?: number;
    rakumaDataSource?: 'api' | 'scraped' | 'mock';
    rakumaUrl?: string;
    // PayPayフリマ情報
    paypayPrice?: number;
    paypayDataSource?: 'api' | 'scraped' | 'mock';
    paypayUrl?: string;
    // StockX情報
    stockxPriceUsd?: number;
    stockxDataSource?: 'api' | 'scraped' | 'mock';
    stockxSearchUrl?: string;
    // Mercari US情報
    mercariUsPriceUsd?: number;
    mercariUsDataSource?: 'api' | 'scraped' | 'mock';
    mercariUsSearchUrl?: string;
}

type AnalysisMode = 'casual' | 'professional';
type SortKey = 'latest' | 'profitAmountDesc' | 'profitMarginDesc' | 'domesticPriceAsc';

export default function DashboardPage() {
    const [listings, setListings] = useState<DashboardProductListing[]>([]);
    const [expandedProfitId, setExpandedProfitId] = useState<string | null>(null);
    const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('casual');
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [tagFilter, setTagFilter] = useState<ListingTag | 'all'>('all');
    const [sortKey, setSortKey] = useState<SortKey>('profitAmountDesc');
    const [minProfitFilter, setMinProfitFilter] = useState<1100 | 3000>(1100);

    // シミュレータ用ステート
    const [simProductSku, setSimProductSku] = useState('GADGET-XYZ-001');
    const [simDomesticPlatform, setSimDomesticPlatform] = useState<'Mercari' | 'Yahoo Auctions' | 'Rakuma' | 'PayPayフリマ'>('Mercari');
    const [simOverseasPlatform, setSimOverseasPlatform] = useState<'eBay' | 'StockX' | 'Amazon' | 'Mercari US'>('eBay');
    const [simDestinationCountry, setSimDestinationCountry] = useState('US');
    const [simManualDomesticPrice, setSimManualDomesticPrice] = useState('');
    const [simTargetSellingPrice, setSimTargetSellingPrice] = useState('');
    const [simResult, setSimResult] = useState<any | null>(null);
    const [simError, setSimError] = useState<string | null>(null);
    const [simLoading, setSimLoading] = useState(false);

    const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

    const [recommendedKeywords, setRecommendedKeywords] = useState<string[]>([]);
    const [recommendedKeywordsLoading, setRecommendedKeywordsLoading] = useState(false);
    const [recommendedFromPriceCheck, setRecommendedFromPriceCheck] = useState(true); // true=価格比較で選定済み
    const [recommendedProducts, setRecommendedProducts] = useState<RecommendedProduct[]>([]);
    const [exchangeRateInfo, setExchangeRateInfo] = useState<{ rate: number; source: string } | null>(null);
    const [productSkus, setProductSkus] = useState<{ sku: string; name: string }[]>([]);
    const [analysisProductSku, setAnalysisProductSku] = useState<string>(''); // 分析時に紐づける商品SKU（空=指定しない）
    const [activityLogsOpen, setActivityLogsOpen] = useState(false);
    const [activityLogs, setActivityLogs] = useState<{ timestamp: string; workflow_name: string; status: string; message?: string; product_sku?: string }[]>([]);
    const [activityLogsLoading, setActivityLogsLoading] = useState(false);
    const [listingsPageSize, setListingsPageSize] = useState(30);

    // ローカルストレージからタグ・メモ情報を読み込む
    const loadListingMeta = () => {
        if (typeof window === 'undefined') return {};
        try {
            const raw = window.localStorage.getItem('listingMeta');
            if (!raw) return {};
            return JSON.parse(raw) as Record<string, { tag: ListingTag; note: string }>;
        } catch {
            return {};
        }
    };

    const saveListingMeta = (meta: Record<string, { tag: ListingTag; note: string }>) => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('listingMeta', JSON.stringify(meta));
    };

    // APIレスポンスをJSONとして取得（HTMLが返った場合は分かりやすいエラーに）
    const getJsonFromResponse = async (res: Response): Promise<Record<string, unknown>> => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await res.text();
            if (text.trimStart().startsWith('<!')) {
                throw new Error('サーバーからHTMLが返りました。APIの設定（.env.local の Supabase 等）を確認してください。');
            }
            throw new Error(text.slice(0, 200) || 'レスポンスの解析に失敗しました。');
        }
        return res.json() as Promise<Record<string, unknown>>;
    };

    // データの取得
    const fetchData = async () => {
        try {
            const res = await fetch('/api/products');
            const result = await getJsonFromResponse(res) as { success: boolean; data?: unknown[]; error?: string };
            if (!res.ok) throw new Error(result.error || 'データの取得に失敗しました');

            if (result.success && Array.isArray(result.data)) {
                const meta = loadListingMeta();
                const mappedListings: DashboardProductListing[] = result.data.map((item: any) => {
                    const id = item.listing_id || Math.random().toString(36).substr(2, 9);
                    const metaForListing = meta[id] || { tag: 'none' as ListingTag, note: '' };
                    return {
                        id,
                        productSku: item.product_sku || 'N/A',
                        imageUrl: item.imageUrl || "https://placehold.co/400x300/1e293b/FFFFFF?text=No+Image",
                        productTitleJP: item.title || '無題の商品',
                        productCategory: item.category || '未分類',
                        domesticPrice: item.price || 0,
                        overseasSellingPrice: {
                            amount: item.optimalPrice || 0,
                            currency: 'USD'
                        },
                        estimatedNetProfitJPY: item.profitDetails?.estimatedProfitJPY || 0,
                        profitMarginPercentage: item.profitMargin || 0,
                        profitDetails: item.profitDetails,
                        aiEnglishDescription: item.optimizedEnglishDescription || '説明文はまだ生成されていません。',
                        listingUrl: item.listing_url || '#',
                        ebaySearchUrl: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(item.title || '')}`,
                        lastSynced: item.updated_at || new Date().toISOString(),
                        dataSource: item.data_source || 'scraped',
                        tag: metaForListing.tag,
                        note: metaForListing.note,
                    };
                });
                // 新しい順にソート
                mappedListings.sort((a, b) => new Date(b.lastSynced).getTime() - new Date(a.lastSynced).getTime());
                setListings(mappedListings);
                setLastUpdated(new Date());
                fetchRecommendedKeywords();
            }
        } catch (e) {
            console.error(e);
            const msg = e instanceof Error ? e.message : 'データの読み込みに失敗しました。';
            setError(translateErrorMessage(msg));
        } finally {
            setLoading(false);
        }
    };

    const fetchRecommendedKeywords = async () => {
        setRecommendedKeywordsLoading(true);
        try {
            const res = await fetch('/api/recommended-keywords');
            const json = await getJsonFromResponse(res) as { success?: boolean; keywords?: string[]; fromPriceCheck?: boolean; products?: RecommendedProduct[]; exchangeRate?: number; exchangeRateSource?: string };
            if (json.keywords && Array.isArray(json.keywords)) {
                setRecommendedKeywords(json.keywords);
                setRecommendedFromPriceCheck(json.fromPriceCheck !== false);
            } else {
                setRecommendedKeywords([]);
                setRecommendedFromPriceCheck(false);
            }
            if (json.products && Array.isArray(json.products)) {
                setRecommendedProducts(json.products);
            } else {
                setRecommendedProducts([]);
            }
            if (json.exchangeRate) {
                setExchangeRateInfo({ rate: json.exchangeRate, source: json.exchangeRateSource || 'unknown' });
            }
        } catch {
            setRecommendedKeywords([]);
            setRecommendedFromPriceCheck(false);
            setRecommendedProducts([]);
        } finally {
            setRecommendedKeywordsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchRecommendedKeywords();
        (async () => {
            try {
                const res = await fetch('/api/product-skus');
                const json = await getJsonFromResponse(res) as { items?: { sku: string; name: string }[] };
                if (json.items && Array.isArray(json.items)) setProductSkus(json.items);
            } catch {
                setProductSkus([]);
            }
        })();
        const interval = setInterval(fetchData, 60000); // 60秒ごとに更新（無料枠最適化）
        return () => clearInterval(interval);
    }, []);

    // シミュレータの初期SKU: productSkus の先頭があれば使用
    useEffect(() => {
        if (productSkus.length > 0) {
            setSimProductSku((prev) => (productSkus.some((p) => p.sku === prev) ? prev : productSkus[0].sku));
        }
    }, [productSkus]);

    // モード・タグ・ソートに応じたフィルタリング
    const filteredListings = useMemo(() => {
        let base = [...listings];
        base = base.filter(l => l.estimatedNetProfitJPY >= minProfitFilter);

        if (tagFilter !== 'all') {
            base = base.filter(l => l.tag === tagFilter);
        }

        base.sort((a, b) => {
            switch (sortKey) {
                case 'profitAmountDesc':
                    return b.estimatedNetProfitJPY - a.estimatedNetProfitJPY;
                case 'profitMarginDesc':
                    return b.profitMarginPercentage - a.profitMarginPercentage;
                case 'domesticPriceAsc':
                    return a.domesticPrice - b.domesticPrice;
                case 'latest':
                default:
                    return new Date(b.lastSynced).getTime() - new Date(a.lastSynced).getTime();
            }
        });

        return base;
    }, [listings, tagFilter, sortKey, minProfitFilter]);

    // フィルターで除外されている件数
    const hiddenCount = useMemo(() => {
        return listings.length - filteredListings.length;
    }, [listings, filteredListings]);

    const translateErrorMessage = (raw: string): string => {
        if (!raw) return "分析中にエラーが発生しました。時間をおいて再度お試しください。";
        if (raw.includes('Supabase') || raw.includes('NEXT_PUBLIC_SUPABASE_URL') || raw.includes('接続設定')) {
            return "Supabaseの接続設定に問題があります。Vercel の環境変数（SUPABASE_URL / SUPABASE_ANON_KEY）が正しく設定されているか確認してください。";
        }
        if (raw.includes('relation') && raw.includes('does not exist')) {
            return "データベースのテーブルが存在しません。Supabase ダッシュボードの SQL Editor で schema.sql を実行してテーブルを作成してください。";
        }
        if (raw.includes('permission denied') || raw.includes('row-level security')) {
            return "データベースのアクセス権限エラーです。Vercel の環境変数に SUPABASE_SERVICE_ROLE_KEY を設定するか、Supabase の RLS ポリシーを確認してください。";
        }
        if (raw.includes('Failed to read data') || raw.includes('Failed to fetch')) {
            return "APIサーバーへの接続に失敗しました。Vercel のデプロイ状態と環境変数（SUPABASE_URL / SUPABASE_ANON_KEY）を確認してください。";
        }
        if (raw.includes('Product with SKU') && raw.includes('not found')) {
            return "指定されたSKUの商品がDBに見つかりません。まず Supabase の products テーブルに商品情報を登録してください。";
        }
        if (raw.includes('weight_kg') || raw.includes('hs_code')) {
            return "商品に重量またはHSコードが設定されていないため、利益計算ができません。products テーブルの weight_kg / hs_code を設定してください。";
        }
        if (raw.includes('Exchange rate')) {
            return "為替レートがDBに存在しないか不正です。exchange_rates テーブルに JPY/USD など必要なレートを登録してください。";
        }
        if (raw.includes('shipping') || raw.includes('No shipping')) {
            return "配送先に対応する送料が見つかりません。shipping_zones / shipping_rates テーブルを確認してください。";
        }
        if (raw.includes('customs') || raw.includes('duty')) {
            return "関税情報が見つかりません。customs_duties テーブルを確認してください。";
        }
        if (raw.includes('domestic purchase price') || raw.includes('purchase_price')) {
            return "国内仕入価格が設定されていません。products テーブルの purchase_price を設定するか、シミュレータで手動入力してください。";
        }
        return raw;
    };

    const [analyzingKeyword, setAnalyzingKeyword] = useState('');

    // 分析の実行（バックグラウンド対応）
    const handleAnalyze = async (e?: React.FormEvent, keyword?: string) => {
        if (e) e.preventDefault();
        const finalKeyword = keyword || searchKeyword;
        if (!finalKeyword.trim()) return;

        setAnalyzing(true);
        setAnalyzingKeyword(finalKeyword);
        setError(null);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    keyword: finalKeyword,
                    ...(analysisProductSku.trim() && { productSku: analysisProductSku.trim() }),
                }),
            });
            const result = await getJsonFromResponse(res) as { success: boolean; taskId?: string; error?: string };
            if (!result.success) throw new Error(result.error);

            // 分析開始メッセージ（ポーリング中に表示）
            setError(null);

            // バックグラウンド実行の完了をポーリングで待機（最大5分でタイムアウト）
            if (result.taskId) {
                const pollIntervalMs = 3000;
                const pollTimeoutMs = 5 * 60 * 1000;
                const startedAt = Date.now();
                const pollInterval = setInterval(async () => {
                    if (Date.now() - startedAt > pollTimeoutMs) {
                        clearInterval(pollInterval);
                        setAnalyzing(false);
                        setAnalyzingKeyword('');
                        setError('分析が時間内に完了しませんでした。一覧を更新して結果を確認してください。');
                        return;
                    }
                    try {
                        const statusRes = await fetch(`/api/analyze?taskId=${result.taskId}`);
                        const statusResult = await getJsonFromResponse(statusRes) as { status?: string; error?: string };
                        if (statusResult.status === 'completed') {
                            clearInterval(pollInterval);
                            await fetchData();
                            fetchRecommendedKeywords();
                            setSearchKeyword('');
                            setAnalyzing(false);
                            setAnalyzingKeyword('');
                        } else if (statusResult.status === 'failed') {
                            clearInterval(pollInterval);
                            setError(translateErrorMessage(statusResult.error || '分析に失敗しました'));
                            setAnalyzing(false);
                            setAnalyzingKeyword('');
                        }
                    } catch {
                        clearInterval(pollInterval);
                        setAnalyzing(false);
                        setAnalyzingKeyword('');
                    }
                }, pollIntervalMs);
            } else {
                await fetchData();
                setSearchKeyword('');
                setAnalyzing(false);
                setAnalyzingKeyword('');
            }
        } catch (e: any) {
            setError(translateErrorMessage(e.message));
            setAnalyzing(false);
            setAnalyzingKeyword('');
        }
    };

    // --- 将来的なアクションハンドラ (スタブ) ---
    const handleListOnPlatform = async (listingId: string) => {
        console.log(`[Dashboard] handleListOnPlatform called for listing: ${listingId} (未実装)`);
        alert('eBay出品機能は現在開発中です。');
    };

    const handleUpdatePrice = async (listingId: string) => {
        console.log(`[Dashboard] handleUpdatePrice called for listing: ${listingId} (未実装)`);
        alert('価格更新機能は現在開発中です。');
    };

    const handleIgnore = async (listingId: string) => {
        console.log(`[Dashboard] handleIgnore called for listing: ${listingId} (未実装)`);
        alert('無視機能は現在開発中です。');
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ja-JP');
    };

    // タグ更新
    const updateListingTag = (id: string, tag: ListingTag) => {
        setListings(prev => {
            const next = prev.map(l => l.id === id ? { ...l, tag } : l);
            const meta = loadListingMeta();
            const target = next.find(l => l.id === id);
            if (target) {
                meta[id] = { tag: target.tag, note: target.note };
                saveListingMeta(meta);
            }
            return next;
        });
    };

    // メモ更新
    const updateListingNote = (id: string, note: string) => {
        setListings(prev => {
            const next = prev.map(l => l.id === id ? { ...l, note } : l);
            const meta = loadListingMeta();
            const target = next.find(l => l.id === id);
            if (target) {
                meta[id] = { tag: target.tag, note: target.note };
                saveListingMeta(meta);
            }
            return next;
        });
    };

    // CSVエクスポート
    const handleExportCsv = () => {
        if (filteredListings.length === 0) return;
        const headers = [
            'SKU',
            'Title',
            'Category',
            'DomesticPriceJPY',
            'OverseasPrice',
            'Currency',
            'EstimatedProfitJPY',
            'ProfitMargin',
            'Tag',
            'ListingUrl',
            'EbaySearchUrl',
            'LastSynced',
            'DataSource',
        ];
        const rows = filteredListings.map(l => [
            l.productSku,
            l.productTitleJP.replace(/"/g, '""'),
            l.productCategory,
            l.domesticPrice,
            l.overseasSellingPrice.amount,
            l.overseasSellingPrice.currency,
            Math.floor(l.estimatedNetProfitJPY),
            l.profitMarginPercentage,
            l.tag,
            l.listingUrl,
            l.ebaySearchUrl,
            l.lastSynced,
            l.dataSource,
        ]);

        const lines = [
            headers.join(','),
            ...rows.map(r => r.map(v => (typeof v === 'string' ? `"${v}"` : String(v))).join(',')),
        ];
        const csvContent = lines.join('\r\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arbitrage_listings_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // シミュレーション実行（クライアント側バリデーション）
    const validateSimulateInputs = (): string | null => {
        if (!simProductSku.trim()) return 'SKUを入力してください。';
        const targetPrice = Number(simTargetSellingPrice);
        if (!simTargetSellingPrice || isNaN(targetPrice)) return '目標販売価格（USD）を入力してください。';
        if (targetPrice <= 0) return '目標販売価格は0より大きい値を入力してください。';
        const domesticPrice = simManualDomesticPrice ? Number(simManualDomesticPrice) : null;
        if (domesticPrice !== null && (isNaN(domesticPrice) || domesticPrice < 0)) {
            return '国内仕入価格は0以上の数値を入力するか、空欄にしてください。';
        }
        const country = simDestinationCountry?.trim();
        if (country && (country.length !== 2 || !/^[A-Z]{2}$/i.test(country))) {
            return '配送先国コードは2文字の英字（例: US, JP）を入力してください。';
        }
        return null;
    };

    const handleSimulate = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateSimulateInputs();
        if (validationError) {
            setSimError(validationError);
            setSimResult(null);
            return;
        }
        setSimLoading(true);
        setSimError(null);
        setSimResult(null);

        try {
            const res = await fetch('/api/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productSku: simProductSku,
                    domesticPlatform: simDomesticPlatform,
                    overseasPlatform: simOverseasPlatform,
                    destinationCountryCode: simDestinationCountry,
                    manualDomesticPrice: simManualDomesticPrice,
                    targetSellingPriceOverseas: simTargetSellingPrice,
                }),
            });
            const result = await getJsonFromResponse(res) as { success: boolean; data?: unknown; error?: string };
            if (!result.success) {
                throw new Error(result.error);
            }
            setSimResult(result.data);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            setSimError(translateErrorMessage(message));
        } finally {
            setSimLoading(false);
        }
    };

    const generateListingTemplate = (listing: DashboardProductListing) => {
        const lines: string[] = [];
        lines.push(`Title: ${listing.productTitleJP}`);
        lines.push(`Price: ${listing.overseasSellingPrice.amount.toFixed(2)} ${listing.overseasSellingPrice.currency}`);
        lines.push('Shipping: Enter your international shipping method and cost here.');
        lines.push('');
        lines.push('Description (English):');
        lines.push(listing.aiEnglishDescription);
        lines.push('');
        lines.push('Notes:');
        lines.push('- Item ships from Japan.');
        lines.push('- Please check photos for condition details.');
        return lines.join('\n');
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-indigo-500/30">
            {/* ヘッダー */}
            <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shadow-2xl sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-indigo-500/40 shadow-xl border border-white/10">
                            <span className="text-white font-black text-xl tracking-tighter">AG</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-slate-400 tracking-tight">
                                越境EC価格最適化エージェント
                            </h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Arbitrage AI System v2.0</p>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                        {/* モードセレクター */}
                        <div className="flex bg-slate-800/50 p-1 rounded-xl border border-slate-700/50">
                            <button
                                onClick={() => setAnalysisMode('casual')}
                                aria-pressed={analysisMode === 'casual'}
                                aria-label="手軽にコツコツモード（低単価・高回転）"
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all focus:ring-2 focus:ring-indigo-400 focus:outline-none ${analysisMode === 'casual' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                手軽にコツコツ
                            </button>
                            <button
                                onClick={() => setAnalysisMode('professional')}
                                aria-pressed={analysisMode === 'professional'}
                                aria-label="一撃重視プロモード（高単価・高利益）"
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all focus:ring-2 focus:ring-indigo-400 focus:outline-none ${analysisMode === 'professional' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                一撃重視プロ
                            </button>
                        </div>

                        {/* 検索バー */}
                        <div className="flex flex-col gap-3 w-full md:w-auto">
                            <form onSubmit={(e) => handleAnalyze(e)} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full md:w-auto">
                                <div className="relative w-full md:w-80 group">
                                    <input
                                        type="text"
                                        placeholder="キーワードで市場を分析..."
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        disabled={analyzing}
                                        className="w-full bg-slate-800/50 border border-slate-700/80 rounded-full py-2.5 pl-5 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-600 text-sm disabled:opacity-50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={analyzing}
                                        aria-label={analyzing ? '分析中...' : 'キーワードで市場を分析'}
                                        className="absolute right-1.5 top-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white p-1.5 rounded-full transition-all shadow-lg shadow-indigo-600/20 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
                                    >
                                        {analyzing ? (
                                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : (
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                        )}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 min-w-0">
                                    <label htmlFor="analysis-sku" className="text-[10px] font-black text-slate-500 uppercase tracking-tighter shrink-0 whitespace-nowrap">分析用商品:</label>
                                    <select
                                        id="analysis-sku"
                                        value={analysisProductSku}
                                        onChange={(e) => setAnalysisProductSku(e.target.value)}
                                        disabled={analyzing}
                                        className="flex-1 min-w-0 bg-slate-800/50 border border-slate-700/80 rounded-lg py-2 px-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 disabled:opacity-50"
                                    >
                                        <option value="">指定しない</option>
                                        {productSkus.map(({ sku, name }) => (
                                            <option key={sku} value={sku}>{name || sku}</option>
                                        ))}
                                    </select>
                                </div>
                            </form>
                            {productSkus.length === 0 && (
                                <p className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                                    商品がありません。schema.sql のシードでサンプルを投入するか、products テーブルに商品を登録してください。分析用商品を選ばないと利益が計算されず一覧に0件になります。
                                </p>
                            )}
                            <p className="text-[10px] text-slate-500">
                                おすすめは国内4サイト（メルカリ・ヤフオク・ラクマ・PayPayフリマ）と海外4サイト（eBay・Amazon・StockX・Mercari US）の価格を比較して最適な仕入先・販売先の組み合わせを選んでいます。分析後に一覧に商品を表示するには「分析用商品」でSKUを選んでから実行してください。
                            </p>
                            <div className="flex flex-wrap gap-2 items-center">
                                <span
                                    className="text-[10px] font-black text-slate-500 uppercase tracking-tighter"
                                    title="選定方法: 候補キーワードでメルカリ・ヤフオク・eBay・Amazonの価格を取得し、最適な仕入先・販売先の組み合わせで簡易利益（海外売上−仕入−手数料−送料）が1,100円以上になるキーワードのみ表示。"
                                >
                                    おすすめ{recommendedFromPriceCheck ? '（国内・海外価格から算出）' : '（参考・候補）'}:
                                </span>
                                {recommendedKeywordsLoading ? (
                                    <span className="text-[10px] text-amber-400/90 inline-flex items-center gap-1.5">
                                        <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        おすすめキーワードを取得中…（国内・海外の価格を比較しています）
                                    </span>
                                ) : recommendedKeywords.length > 0 ? (
                                    <>
                                        {recommendedKeywords.map(kw => (
                                            <button
                                                key={kw}
                                                type="button"
                                                onClick={() => { handleAnalyze(undefined, kw); }}
                                                className="text-[10px] font-black px-2 py-0.5 rounded-md border transition-all bg-slate-800 hover:bg-indigo-500/20 hover:text-indigo-400 border-slate-700"
                                            >
                                                {kw}
                                            </button>
                                        ))}
                                        {!recommendedFromPriceCheck && (
                                            <span className="text-[9px] text-slate-500 ml-1" title="ScrapingBee APIを設定すると、実際の価格を取得して利益が出そうなキーワードだけを表示できます">
                                                （参考表示・価格未取得）
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-[10px] text-slate-500">
                                        利益が出そうなキーワードはありません。検索バーで別のキーワードを試すか、.env.local に SCRAPINGBEE_API_KEY を設定して再読み込みしてください。
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {analyzing && !error && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm">
                        分析を開始しました。完了まで1〜3分かかることがあります。完了したら一覧を自動で更新します。
                    </div>
                )}
                {error && (
                    <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-xl text-red-400 text-sm flex items-start gap-3">
                        <svg className="h-5 w-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <div>
                            <p>{error}</p>
                            {(error.includes('Supabase') || error.includes('接続設定') || error.includes('環境変数')) && (
                                <p className="mt-2 text-amber-300/90 text-xs">
                                    Vercel の場合: Vercel ダッシュボード → Settings → Environment Variables で <code className="bg-slate-800 px-1 rounded">SUPABASE_URL</code> と <code className="bg-slate-800 px-1 rounded">SUPABASE_ANON_KEY</code> を設定後、再デプロイしてください。<br/>
                                    ローカルの場合: .env.local を確認後、サーバーを再起動してください。
                                </p>
                            )}
                            {error.includes('テーブルが存在しません') && (
                                <p className="mt-2 text-amber-300/90 text-xs">
                                    Supabase ダッシュボード → SQL Editor で <code className="bg-slate-800 px-1 rounded">schema.sql</code> を実行してテーブルを作成してください。
                                </p>
                            )}
                            {error.includes('アクセス権限') && (
                                <p className="mt-2 text-amber-300/90 text-xs">
                                    Vercel の環境変数に <code className="bg-slate-800 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> を追加すると解決する場合があります。
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {analyzing && (
                    <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="inline-flex items-center gap-3 bg-indigo-500/10 border border-indigo-500/30 px-6 py-3 rounded-2xl shadow-2xl">
                            <div className="flex gap-1.5">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                            </div>
                            <span className="text-sm font-bold text-indigo-300">「{analyzingKeyword || searchKeyword}」の市場をAIが分析中...（1〜3分ほどお待ちください）</span>
                        </div>
                    </div>
                )}

                {/* 統計エリア */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                    <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path></svg>
                        </div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">表示中の商品</h3>
                        <p className="text-4xl font-black text-white">{filteredListings.length}</p>
                    </div>
                    <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity text-emerald-500">
                            <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                        </div>
                        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{analysisMode === 'professional' ? '高収益案件' : '優良案件'}</h3>
                        <p className="text-4xl font-black text-emerald-400">
                            {filteredListings.filter(l => l.profitMarginPercentage >= 0.10).length}
                        </p>
                    </div>
                    <div className="col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 flex items-center justify-between shadow-xl">
                        <div>
                            <h3 className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-1">現在の分析モード</h3>
                            <p className="text-xl font-black text-white">{analysisMode === 'casual' ? '手軽にコツコツ (Casual)' : '一撃重視プロ (Professional)'}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{analysisMode === 'casual' ? '低単価・高回転の商品を中心におすすめします。' : '一撃で大きな純利益が狙える高単価商品のみを表示します。'}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${analysisMode === 'casual' ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-purple-500/20 border-purple-500/30'}`}>
                            {analysisMode === 'casual' ? (
                                <svg className="w-6 h-6 text-indigo-400" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3.005 3.005 0 013.75-2.906z"></path></svg>
                            ) : (
                                <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 4.946-2.52 9.3-6.333 11.908a.75.75 0 01-.834 0c-3.813-2.608-6.333-6.962-6.333-11.908 0-.68.056-1.35.166-2.001zm11.54 3.03a.75.75 0 00-1.06-1.06l-4.242 4.242-1.415-1.414a.75.75 0 10-1.06 1.06l1.944 1.945a.75.75 0 001.06 0l4.773-4.773z" clipRule="evenodd"></path></svg>
                            )}
                        </div>
                    </div>
                </div>

                {/* おすすめ商品セクション */}
                <div className="mb-8">
                    <p className="text-[10px] text-amber-400/80 mb-3">
                        ⚠️ <strong>推定利益について</strong>: 同一キーワードの国内価格と海外相場の中央値を比較しています。<strong>表示されている国内商品と海外商品は同一商品とは限りません。</strong>
                        必ずeBay等で「同じ商品」が実際にいくらで売れているか確認してから仕入れてください。価格差が8倍以上の組み合わせは自動除外しています。
                    </p>
                    <div className="flex items-center gap-2 mb-4">
                        <svg className="h-5 w-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                        <h2 className="text-sm font-black text-amber-300 uppercase tracking-wider">おすすめ商品</h2>
                        <span className="text-[10px] text-slate-500">
                            {recommendedFromPriceCheck ? '8プラットフォームの価格から最適ルート自動選定' : '参考表示'}
                        </span>
                        {exchangeRateInfo && (
                            <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-md border ${exchangeRateInfo.source === 'live' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border-slate-600'}`}>
                                1 USD = {exchangeRateInfo.rate.toFixed(1)} JPY {exchangeRateInfo.source === 'live' ? '(リアルタイム)' : exchangeRateInfo.source === 'database' ? '(DB)' : '(固定値)'}
                            </span>
                        )}
                    </div>
                    {recommendedKeywordsLoading ? (
                        <div className="flex items-center justify-center py-12 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 border-3 border-slate-700 border-t-amber-400 rounded-full animate-spin"></div>
                                <span className="text-sm text-slate-400 font-bold">おすすめ商品を検索中...</span>
                            </div>
                        </div>
                    ) : recommendedProducts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recommendedProducts.map((product, idx) => (
                                <div
                                    key={`${product.keyword}-${idx}`}
                                    className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden hover:border-amber-500/40 hover:shadow-[0_0_30px_-10px_rgba(245,158,11,0.2)] transition-all duration-300 flex flex-col"
                                >
                                    <div className="relative h-36 overflow-hidden bg-slate-800">
                                        <img
                                            src={product.imageUrl}
                                            alt={product.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute top-2 left-2">
                                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter backdrop-blur-md border bg-amber-500/20 text-amber-300 border-amber-500/30">
                                                {product.keyword}
                                            </span>
                                        </div>
                                        <div className="absolute top-2 right-2">
                                            <span className="px-2 py-0.5 rounded-md text-[9px] font-black backdrop-blur-md border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                                +¥{product.estimatedProfitJpy.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col">
                                        <h4 className="text-xs font-bold text-slate-200 line-clamp-2 mb-2 leading-snug">
                                            {product.title}
                                        </h4>
                                        {/* 仕入れ先 → 販売先ルート（視覚的に明確化） */}
                                        <div className="flex items-center gap-1.5 mb-2 p-2 bg-slate-800/60 rounded-lg border border-slate-700/50">
                                            <div className="flex-1 text-center">
                                                <p className="text-[8px] text-slate-500 font-black uppercase">🛒 仕入れ</p>
                                                <p className="text-[10px] text-slate-300 font-bold">
                                                    {product.domesticPlatform === 'Yahoo Auctions' ? 'ヤフオク' : product.domesticPlatform === 'Rakuma' ? 'ラクマ' : product.domesticPlatform === 'PayPayフリマ' ? 'PayPay' : 'メルカリ'}
                                                </p>
                                                <p className="text-sm font-black text-white">¥{(product.domesticPrice || product.mercariPrice).toLocaleString()}</p>
                                            </div>
                                            <div className="text-indigo-400 font-black text-base shrink-0">→</div>
                                            <div className="flex-1 text-center">
                                                <p className="text-[8px] text-indigo-400 font-black uppercase">💰 販売</p>
                                                <p className="text-[10px] text-indigo-300 font-bold">{product.overseasPlatform || 'eBay'}</p>
                                                <p className="text-sm font-black text-indigo-200">${(product.overseasPrice || product.ebayPriceUsd).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mb-2 text-[10px]">
                                            <div>
                                                <span className="text-slate-500">推定利益:</span>{' '}
                                                <span className="text-emerald-400 font-black">+¥{product.estimatedProfitJpy.toLocaleString()}</span>
                                                <span className="text-amber-400/90 text-[9px] ml-1">（簡易・関税等未考慮）</span>
                                            </div>
                                            <div>
                                                <span className="text-slate-500">利益率:</span>{' '}
                                                <span className="text-emerald-400 font-bold">{(product.profitMarginPercent * 100).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                                            {/* 仕入先データソース */}
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${
                                                (product.domesticDataSource || product.mercariDataSource) === 'api' || (product.domesticDataSource || product.mercariDataSource) === 'scraped'
                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                            }`}>
                                                仕入: {(product.domesticDataSource || product.mercariDataSource) === 'api' || (product.domesticDataSource || product.mercariDataSource) === 'scraped' ? '実データ' : '推定価格'}
                                            </span>
                                            {/* 販売先データソース */}
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border ${
                                                (product.overseasDataSource || product.ebayDataSource) === 'api' || (product.overseasDataSource || product.ebayDataSource) === 'scraped'
                                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                                    : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                            }`}>
                                                販売: {(product.overseasDataSource || product.ebayDataSource) === 'api' || (product.overseasDataSource || product.ebayDataSource) === 'scraped' ? '実データ' : '推定価格'}
                                            </span>
                                        </div>
                                        <div className="mt-auto space-y-1.5">
                                            {/* 仕入れボタン群（国内） */}
                                            <p className="text-[8px] text-slate-600 font-black uppercase tracking-wider">🛒 仕入れ先（国内）</p>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {(product.mercariUrl && product.mercariUrl !== '#') && (
                                                    <a href={product.mercariUrl} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold py-1.5 rounded-lg transition-all border border-slate-700">
                                                        メルカリで仕入れる
                                                    </a>
                                                )}
                                                {(product.yahooUrl || (product.domesticPlatform === 'Yahoo Auctions' && product.domesticUrl && product.domesticUrl !== '#')) && (
                                                    <a href={product.domesticPlatform === 'Yahoo Auctions' ? product.domesticUrl : (product.yahooUrl || '#')} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-1 bg-red-900/40 hover:bg-red-800/50 text-red-300 text-[10px] font-bold py-1.5 rounded-lg transition-all border border-red-700/40">
                                                        ヤフオクで仕入れる
                                                    </a>
                                                )}
                                                {(product.rakumaUrl || (product.domesticPlatform === 'Rakuma' && product.domesticUrl && product.domesticUrl !== '#')) && (
                                                    <a href={product.domesticPlatform === 'Rakuma' ? product.domesticUrl : (product.rakumaUrl || '#')} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-1 bg-pink-900/40 hover:bg-pink-800/50 text-pink-300 text-[10px] font-bold py-1.5 rounded-lg transition-all border border-pink-700/40">
                                                        ラクマで仕入れる
                                                    </a>
                                                )}
                                                {(product.paypayUrl || (product.domesticPlatform === 'PayPayフリマ' && product.domesticUrl && product.domesticUrl !== '#')) && (
                                                    <a href={product.domesticPlatform === 'PayPayフリマ' ? product.domesticUrl : (product.paypayUrl || '#')} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-1 bg-rose-900/40 hover:bg-rose-800/50 text-rose-300 text-[10px] font-bold py-1.5 rounded-lg transition-all border border-rose-700/40">
                                                        PayPayで仕入れる
                                                    </a>
                                                )}
                                            </div>
                                            {/* 販売ボタン群（海外） */}
                                            <p className="text-[8px] text-indigo-500 font-black uppercase tracking-wider mt-1">💰 販売先（海外）</p>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <a href={product.ebaySearchUrl} target="_blank" rel="noopener noreferrer"
                                                    className="flex items-center justify-center gap-1 bg-indigo-600/80 hover:bg-indigo-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all">
                                                    eBayで売る
                                                </a>
                                                {product.amazonSearchUrl && (
                                                    <a href={product.amazonSearchUrl} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-1 bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all">
                                                        Amazonで売る
                                                    </a>
                                                )}
                                                {product.stockxSearchUrl && (
                                                    <a href={product.stockxSearchUrl} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-1 bg-emerald-600/80 hover:bg-emerald-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all">
                                                        StockXで売る
                                                    </a>
                                                )}
                                                {product.mercariUsSearchUrl && (
                                                    <a href={product.mercariUsSearchUrl} target="_blank" rel="noopener noreferrer"
                                                        className="flex items-center justify-center gap-1 bg-sky-600/80 hover:bg-sky-500 text-white text-[10px] font-bold py-1.5 rounded-lg transition-all">
                                                        Mercari USで売る
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center bg-slate-800/20 rounded-2xl border border-dashed border-slate-700">
                            <p className="text-[11px] text-slate-500">
                                利益が出そうな商品は見つかりませんでした。ScrapingBee APIキーを設定するとeBay価格を取得してリアルなおすすめが表示されます。
                            </p>
                        </div>
                    )}
                </div>

                {/* ステータス・ソート・フィルタ & エクスポート */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                    <div className="text-[11px] text-slate-500">
                        <span className="font-bold">最終同期:</span>{' '}
                        {lastUpdated ? lastUpdated.toLocaleString('ja-JP') : '-'}
                        {(sortKey === 'profitAmountDesc' || sortKey === 'profitMarginDesc') && (
                            <span className="ml-2 text-emerald-500/90">（利益が出やすい順で表示中）</span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <select
                            value={sortKey}
                            onChange={(e) => setSortKey(e.target.value as SortKey)}
                            className="bg-slate-900 border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-slate-300"
                        >
                            <option value="profitAmountDesc">並び順: 利益額が高い順</option>
                            <option value="profitMarginDesc">並び順: 利益率が高い順</option>
                            <option value="latest">並び順: 最新順</option>
                            <option value="domesticPriceAsc">並び順: 仕入価格が安い順</option>
                        </select>
                        <select
                            value={minProfitFilter}
                            onChange={(e) => setMinProfitFilter(Number(e.target.value) as 1100 | 3000)}
                            className="bg-slate-900 border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-slate-300"
                        >
                            <option value={1100}>最低利益: 1,100円以上</option>
                            <option value={3000}>最低利益: 3,000円以上</option>
                        </select>
                        <select
                            value={tagFilter}
                            onChange={(e) => setTagFilter(e.target.value as ListingTag | 'all')}
                            className="bg-slate-900 border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-slate-300"
                        >
                            <option value="all">タグ: すべて</option>
                            <option value="potential">タグ: 有望</option>
                            <option value="hold">タグ: 保留</option>
                            <option value="purchased">タグ: 仕入れ済み</option>
                            <option value="none">タグなし</option>
                        </select>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="text-[11px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold"
                        >
                            CSVエクスポート
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                setActivityLogsOpen(!activityLogsOpen);
                                if (!activityLogsOpen && activityLogs.length === 0) {
                                    setActivityLogsLoading(true);
                                    try {
                                        const res = await fetch('/api/activity-logs?limit=50');
                                        const json = await getJsonFromResponse(res) as { success?: boolean; data?: typeof activityLogs };
                                        if (json.success && json.data) setActivityLogs(json.data);
                                    } catch {
                                        setActivityLogs([]);
                                    } finally {
                                        setActivityLogsLoading(false);
                                    }
                                }
                            }}
                            className="text-[11px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-bold"
                        >
                            {activityLogsOpen ? 'ログを閉じる' : '実行ログ'}
                        </button>
                    </div>
                </div>

                {/* 実行ログ（折りたたみ） */}
                {activityLogsOpen && (
                    <div className="mb-8 p-4 bg-slate-900/80 border border-slate-700 rounded-xl max-h-64 overflow-y-auto">
                        <h3 className="text-xs font-bold text-slate-400 mb-2">直近の実行ログ (activity_logs)</h3>
                        {activityLogsLoading ? (
                            <p className="text-slate-500 text-sm">読み込み中...</p>
                        ) : activityLogs.length === 0 ? (
                            <p className="text-slate-500 text-sm">ログがありません。Supabase の activity_logs にデータが記録されます。</p>
                        ) : (
                            <div className="space-y-1 text-[11px] font-mono">
                                {activityLogs.map((log, i) => (
                                    <div key={i} className="flex flex-wrap gap-2 text-slate-400 border-b border-slate-800/50 py-1 last:border-0">
                                        <span className="text-slate-600 shrink-0">{new Date(log.timestamp).toLocaleString('ja-JP')}</span>
                                        <span className={log.status === 'failure' ? 'text-rose-400' : log.status === 'success' ? 'text-emerald-400' : 'text-slate-500'}>{log.status}</span>
                                        <span className="text-slate-500">{log.workflow_name}</span>
                                        {log.product_sku && <span className="text-indigo-400">{log.product_sku}</span>}
                                        {log.message && <span className="text-slate-300 truncate max-w-md">{log.message}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 利益シミュレータ */}
                <div className="mb-12 p-6 bg-slate-900/60 border border-slate-700/80 rounded-2xl">
                    <div className="flex items-center justify-between mb-4 gap-2">
                        <div className="flex items-center gap-2">
                            <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .672-3 1.5S10.343 11 12 11s3 .672 3 1.5S13.657 14 12 14m0-6V6m0 8v2m-9-4a9 9 0 1118 0 9 9 0 01-18 0z"></path></svg>
                            <h3 className="text-sm font-black text-emerald-300 uppercase tracking-wider">クイック利益シミュレータ</h3>
                        </div>
                        <p className="text-[11px] text-slate-500">SKUと想定売価を入れて、ざっくり利益を試算できます。</p>
                    </div>
                    <form onSubmit={handleSimulate} className="grid grid-cols-1 md:grid-cols-5 gap-3 text-[11px]">
                        <div className="flex flex-col gap-1">
                            <label className="text-slate-400 font-bold">SKU</label>
                            <input
                                value={simProductSku}
                                onChange={(e) => setSimProductSku(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-slate-400 font-bold">国内プラットフォーム</label>
                            <select
                                value={simDomesticPlatform}
                                onChange={(e) => setSimDomesticPlatform(e.target.value as 'Mercari' | 'Yahoo Auctions' | 'Rakuma' | 'PayPayフリマ')}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                            >
                                <option value="Mercari">Mercari (10%)</option>
                                <option value="Yahoo Auctions">Yahoo Auctions (8.8%)</option>
                                <option value="Rakuma">Rakuma (6.6%)</option>
                                <option value="PayPayフリマ">PayPayフリマ (5%)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-slate-400 font-bold">海外プラットフォーム</label>
                            <select
                                value={simOverseasPlatform}
                                onChange={(e) => setSimOverseasPlatform(e.target.value as 'eBay' | 'StockX' | 'Amazon' | 'Mercari US')}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                            >
                                <option value="eBay">eBay (12.9%)</option>
                                <option value="Amazon">Amazon (15%)</option>
                                <option value="StockX">StockX (10%)</option>
                                <option value="Mercari US">Mercari US (10%)</option>
                            </select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-slate-400 font-bold">配送先国コード</label>
                            <input
                                value={simDestinationCountry}
                                onChange={(e) => setSimDestinationCountry(e.target.value.toUpperCase())}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                                placeholder="US"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-slate-400 font-bold">目標販売価格 (USD)</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={simTargetSellingPrice}
                                onChange={(e) => setSimTargetSellingPrice(e.target.value)}
                                className={`bg-slate-900 border rounded-lg px-2 py-1 text-slate-100 ${simTargetSellingPrice && Number(simTargetSellingPrice) <= 0 ? 'border-rose-500' : 'border-slate-700'}`}
                                placeholder="例: 120"
                            />
                            {simTargetSellingPrice && Number(simTargetSellingPrice) <= 0 && (
                                <span className="text-[9px] text-rose-400">0より大きい値を入力</span>
                            )}
                        </div>
                        <div className="flex flex-col gap-1 md:col-span-2">
                            <label className="text-slate-400 font-bold">国内仕入価格 (JPY, 任意)</label>
                            <input
                                type="number"
                                min="0"
                                step="1"
                                value={simManualDomesticPrice}
                                onChange={(e) => setSimManualDomesticPrice(e.target.value)}
                                className={`bg-slate-900 border rounded-lg px-2 py-1 text-slate-100 ${simManualDomesticPrice && Number(simManualDomesticPrice) < 0 ? 'border-rose-500' : 'border-slate-700'}`}
                                placeholder="DBのpurchase_priceを使う場合は空欄"
                            />
                            {simManualDomesticPrice && Number(simManualDomesticPrice) < 0 && (
                                <span className="text-[9px] text-rose-400">0以上の値を入力</span>
                            )}
                        </div>
                        <div className="flex items-end md:col-span-3">
                            <button
                                type="submit"
                                disabled={simLoading || !simProductSku.trim() || !simTargetSellingPrice || Number(simTargetSellingPrice) <= 0}
                                aria-label="シミュレーションを実行して利益を計算"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-600/20 disabled:opacity-60 focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                            >
                                {simLoading ? '計算中...' : 'シミュレーションを実行'}
                            </button>
                        </div>
                    </form>
                    {simError && (
                        <div className="mt-3 text-[11px] text-rose-300">
                            {simError}
                        </div>
                    )}
                    {simResult && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-slate-300">
                            <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                                <p className="font-bold text-slate-200 mb-1">売上 (USD換算)</p>
                                <p>販売価格: {simResult.overseasSellingPriceLocalCurrency.toFixed(2)} USD</p>
                                <p>為替レート: 1 USD = {simResult.exchangeRate} JPY</p>
                                <p>売上合計: ¥{Math.floor(simResult.overseasSellingPriceJPY).toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                                <p className="font-bold text-slate-200 mb-1">コスト内訳</p>
                                <p>仕入原価: ¥{simResult.domesticPurchasePriceJPY.toLocaleString()}</p>
                                <p>国際送料: ¥{simResult.internationalShippingCostJPY.toLocaleString()}</p>
                                <p>国内手数料: ¥{simResult.domesticPlatformFeeJPY.toLocaleString()}</p>
                                <p>海外手数料: ¥{simResult.overseasPlatformFeeJPY.toLocaleString()}</p>
                                <p>関税/消費税: ¥{Math.floor(simResult.customsDutyJPY).toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-slate-900 rounded-xl border border-slate-700">
                                <p className="font-bold text-slate-200 mb-1">結果</p>
                                <p className={simResult.estimatedProfitJPY >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                    推定純利益: {simResult.estimatedProfitJPY >= 0 ? '+' : ''}¥{Math.floor(simResult.estimatedProfitJPY).toLocaleString()}
                                </p>
                                <p className="mt-1 text-slate-400">
                                    利益率の目安: {simResult.overseasSellingPriceJPY > 0 ? ((simResult.estimatedProfitJPY / simResult.overseasSellingPriceJPY) * 100).toFixed(1) : '-'}%
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 計算の仕組み解説 */}
                <div className="mb-12 p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl">
                    <div className="flex items-center gap-2 mb-4">
                        <svg className="h-5 w-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <h3 className="text-sm font-black text-indigo-300 uppercase tracking-wider">利益計算の仕組みについて</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[11px] text-slate-400 leading-relaxed">
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <p className="font-bold text-slate-200 mb-1">1. 高い国際送料</p>
                            海外発送（EMSやFedEx）は国内配送に比べ高額（通常3,000円〜）です。商品重量や梱包サイズに基づいて自動計算されています。
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <p className="font-bold text-slate-200 mb-1">2. プラットフォーム手数料</p>
                            仕入時（メルカリ10%・ヤフオク8.8%・ラクマ6.6%・PayPayフリマ5%）と販売時（eBay約13%・Amazon約15%・StockX10%・Mercari US10%）の両方で手数料が発生するため、売価の約15-25%がコストとなります。
                        </div>
                        <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800">
                            <p className="font-bold text-slate-200 mb-1">3. 推定関税と消費税</p>
                            国によって異なりますが、販売価格の一部が輸入時の関税として計算に含まれます。これら全てのコストを引いたものが「推定純利益」です。
                        </div>
                    </div>
                </div>

                {/* 商品グリッド */}
                {loading && listings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-slate-600">
                        <div className="w-16 h-16 border-4 border-slate-800 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
                        <p className="font-bold">データベースを同期中...</p>
                    </div>
                ) : filteredListings.length === 0 ? (
                    <div className="text-center py-32 bg-slate-800/20 rounded-3xl border border-dashed border-slate-700 animate-in fade-in zoom-in-95 duration-500">
                        {listings.length === 0 ? (
                            <div className="max-w-md mx-auto">
                                <h3 className="text-lg font-bold text-slate-200 mb-4">まずは以下を実行してください</h3>
                                <ol className="text-left text-sm text-slate-400 space-y-3 mb-8">
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-400 flex items-center justify-center text-xs font-bold">1</span>
                                        <span>「分析用商品」で SKU を選択（products テーブルに商品がなければ schema.sql のシードを実行）</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-400 flex items-center justify-center text-xs font-bold">2</span>
                                        <span>おすすめキーワードをクリック、または検索バーでキーワードを入力して分析を実行</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-400 flex items-center justify-center text-xs font-bold">3</span>
                                        <span>1〜3分待つと一覧が自動更新されます（完了まで画面の案内を確認）</span>
                                    </li>
                                </ol>
                                <p className="text-xs text-slate-500">まだデータがありません。上記の手順で分析を実行してください。</p>
                            </div>
                        ) : (
                            <>
                        <p className="text-slate-500 font-medium italic mb-6">
                            {analysisMode === 'professional' ? '「プロモード」の基準を満たす高利益商品はまだありません。' : 'キーワードを入力して、利益の出るチャンスを見つけましょう。'}
                        </p>
                        {hiddenCount > 0 && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                                    <p className="text-[11px] text-indigo-300 font-bold">
                                        💡 現在、{hiddenCount}件の商品が利益基準（{analysisMode === 'professional' ? '¥3,000' : '¥1,100'}）未満のため非表示になっています。
                                    </p>
                                </div>
                                <button
                                    onClick={() => setAnalysisMode('casual')}
                                    className="group px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black transition-all shadow-xl shadow-indigo-600/20 flex items-center gap-2"
                                >
                                    「手軽にコツコツ」モードに切り替えて確認する
                                    <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                                </button>
                            </div>
                        )}
                        </>
                        )}
                    </div>
                ) : (
                    <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredListings.slice(0, listingsPageSize).map((listing) => (
                            <div key={listing.id} className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 hover:shadow-[0_0_50px_-12px_rgba(79,70,229,0.3)] transition-all duration-500 flex flex-col relative">
                                {/* 画像セクション */}
                                <div className="relative h-56 overflow-hidden">
                                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-900 to-transparent z-10 opacity-90"></div>
                                    <img
                                        src={listing.imageUrl}
                                        alt={listing.productTitleJP}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                                    />
                                    {/* バッジ */}
                                    <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter backdrop-blur-md border ${listing.profitMarginPercentage >= 0.10 ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'}`}>
                                            利益率 {(listing.profitMarginPercentage * 100).toFixed(1)}%
                                        </span>
                                        {listing.dataSource === 'mock' && (
                                            <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-tighter backdrop-blur-md border bg-amber-500/20 text-amber-400 border-amber-500/30">
                                                Mock Data
                                            </span>
                                        )}
                                    </div>
                                    <div className="absolute bottom-4 left-4 z-20">
                                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 uppercase">
                                            {listing.productCategory}
                                        </span>
                                    </div>
                                </div>

                                {/* コンテンツセクション */}
                                <div className="p-6 flex-1 flex flex-col">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-black text-white mb-2 line-clamp-2 leading-tight group-hover:text-indigo-300 transition-colors">
                                            {listing.productTitleJP}
                                        </h3>

                                        {/* 価格比較: 仕入れ元 → 販売先 */}
                                        <div className="flex items-center justify-between mb-6 p-4 bg-slate-800/30 rounded-2xl border border-slate-700/30">
                                            <div className="text-center">
                                                <p className="text-[9px] text-slate-500 font-black uppercase mb-0.5">🛒 仕入れ元</p>
                                                <p className="text-[10px] text-slate-400 font-bold mb-1">メルカリ（国内）</p>
                                                <p className="text-lg font-bold text-slate-200">¥{listing.domesticPrice.toLocaleString()}</p>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                                                <span className="text-[8px] text-indigo-400 font-bold">売る</span>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-[9px] text-indigo-400 font-black uppercase mb-0.5">💰 販売先</p>
                                                <p className="text-[10px] text-indigo-300 font-bold mb-1">eBay（海外）</p>
                                                <p className="text-lg font-bold text-white">${listing.overseasSellingPrice.amount.toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* AI説明文 */}
                                        <div className="mb-6">
                                            <div className="flex items-center gap-1.5 mb-2">
                                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI generated English Description</span>
                                            </div>
                                            <div className="text-[11px] text-slate-400 leading-relaxed italic line-clamp-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                                                "{listing.aiEnglishDescription}"
                                            </div>
                                        </div>

                                        {/* 利益詳細 */}
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-bold text-slate-500">推定純利益</span>
                                            <button
                                                onClick={() => setExpandedProfitId(expandedProfitId === listing.id ? null : listing.id)}
                                                className="text-[10px] font-black text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30 underline-offset-2"
                                            >
                                                {expandedProfitId === listing.id ? '内訳を閉じる' : '内訳を表示'}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-end mb-2">
                                            <span className={`text-2xl font-black tabular-nums tracking-tighter ${listing.estimatedNetProfitJPY >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {listing.estimatedNetProfitJPY >= 0 ? '+' : ''}¥{Math.floor(listing.estimatedNetProfitJPY).toLocaleString()}
                                            </span>
                                        </div>

                                        {expandedProfitId === listing.id && listing.profitDetails && (
                                            <div className="mb-6 p-4 bg-slate-950/50 rounded-2xl border border-indigo-500/20 animate-in fade-in zoom-in-95 duration-300">
                                                <div className="space-y-2 text-[11px]">
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>販売価格 ({listing.overseasSellingPrice.amount} USD)</span>
                                                        <span className="text-white font-mono">¥{Math.floor(listing.profitDetails.overseasSellingPriceJPY).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-400 italic">
                                                        <span>(為替レート: 1 USD = {listing.profitDetails.exchangeRate} JPY)</span>
                                                    </div>
                                                    <div className="h-px bg-slate-800 my-2"></div>
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>仕入原価 (メルカリ)</span>
                                                        <span className="text-rose-400">-¥{listing.domesticPrice.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>国際送料 (EMS/FedEx推定)</span>
                                                        <span className="text-rose-400">-¥{listing.profitDetails.internationalShippingCostJPY.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>eBay販売手数料 (~13%)</span>
                                                        <span className="text-rose-400">-¥{Math.floor(listing.profitDetails.overseasPlatformFeeJPY).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between text-slate-400">
                                                        <span>メルカリ手数料 (10%)</span>
                                                        <span className="text-rose-400">-¥{listing.profitDetails.domesticPlatformFeeJPY.toLocaleString()}</span>
                                                    </div>
                                                    {listing.profitDetails.customsDutyJPY > 0 && (
                                                        <div className="flex justify-between text-slate-400">
                                                            <span>推定関税/消費税</span>
                                                            <span className="text-rose-400">-¥{Math.floor(listing.profitDetails.customsDutyJPY).toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                    <div className="h-px bg-slate-700 my-1"></div>
                                                    <div className="flex justify-between font-black text-emerald-400 pt-1 border-t border-slate-800">
                                                        <span>合計純利益</span>
                                                        <span>¥{Math.floor(listing.estimatedNetProfitJPY).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* タグ & メモ */}
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">タグ & メモ</span>
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateListingTag(listing.id, 'potential')}
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${listing.tag === 'potential' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
                                                    >
                                                        有望
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateListingTag(listing.id, 'hold')}
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${listing.tag === 'hold' ? 'bg-amber-600 text-white border-amber-500' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
                                                    >
                                                        保留
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateListingTag(listing.id, 'purchased')}
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${listing.tag === 'purchased' ? 'bg-sky-600 text-white border-sky-500' : 'bg-slate-900 text-slate-300 border-slate-700'}`}
                                                    >
                                                        仕入れ済み
                                                    </button>
                                                </div>
                                            </div>
                                            <textarea
                                                value={listing.note}
                                                onChange={(e) => updateListingNote(listing.id, e.target.value)}
                                                placeholder="自分用メモ（仕入れメモ、在庫場所、注意点など）"
                                                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2 py-1 text-[11px] text-slate-200 resize-none h-16"
                                            />
                                        </div>

                                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-8" title={`目標利益率20%に対する達成度: ${Math.min(Math.round((listing.profitMarginPercentage / 0.20) * 100), 100)}%`}>
                                            <div
                                                className={`h-full rounded-full transition-all duration-1000 ${listing.profitMarginPercentage >= 0.20 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : listing.profitMarginPercentage >= 0.10 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                                                style={{ width: `${Math.min((listing.profitMarginPercentage / 0.20) * 100, 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* アクション */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <a
                                            href={listing.listingUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-3 rounded-xl transition-all border border-slate-700 shadow-lg"
                                        >
                                            メルカリで見る
                                        </a>
                                        <a
                                            href={listing.ebaySearchUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center justify-center gap-2 text-white text-xs font-bold py-3 rounded-xl transition-all shadow-xl ${analysisMode === 'casual' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20' : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'}`}
                                        >
                                            eBayで市場調査
                                        </a>
                                    </div>
                                    <a
                                        href={`/listing/${encodeURIComponent(listing.id)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 flex items-center justify-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold py-2.5 rounded-xl border border-emerald-500/30 transition-all"
                                    >
                                        出品用ページで開く（コピー＆eBayへ）
                                    </a>
                                    {/* 出品用テンプレート */}
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={() => setExpandedTemplateId(expandedTemplateId === listing.id ? null : listing.id)}
                                            className="text-[10px] font-black text-slate-400 hover:text-slate-200 underline decoration-slate-600/50 underline-offset-2"
                                        >
                                            {expandedTemplateId === listing.id ? '出品用テンプレートを閉じる' : 'eBay出品用テンプレートを表示'}
                                        </button>
                                        {expandedTemplateId === listing.id && (
                                            <div className="mt-2 p-3 bg-slate-950/60 border border-slate-700 rounded-xl">
                                                <pre className="text-[10px] text-slate-200 whitespace-pre-wrap font-mono">
                                                    {generateListingTemplate(listing)}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[9px] text-slate-600 mt-4 text-center font-bold font-mono tracking-tighter" suppressHydrationWarning>
                                        SYNC: {formatDate(listing.lastSynced)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    {filteredListings.length > listingsPageSize && (
                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={() => setListingsPageSize(p => p + 30)}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-bold border border-slate-700 transition-all"
                                aria-label={`さらに30件表示（残り${filteredListings.length - listingsPageSize}件）`}
                            >
                                もっと見る（残り{filteredListings.length - listingsPageSize}件）
                            </button>
                        </div>
                    )}
                    </>
                )}
            </main>

            {/* フッター */}
            <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-800/50 mt-12 text-center">
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-loose">
                    Antigravity Powered Arbitrage Engine<br />
                    All market data is fetched in real-time. Profit estimates include duties and shipping.
                </p>
            </footer>
        </div>
    );
}
