// --- Database Schema Interfaces (mirroring Step 1 SQL) ---

export interface Product {
    id: string; // UUID
    sku: string;
    name: string;
    description?: string;
    category?: string;
    weight_kg?: number;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
    hs_code?: string;
    purchase_price?: number; // Added for mock/reference
    created_at: string; // TIMESTAMP WITH TIME ZONE
    updated_at: string; // TIMESTAMP WITH TIME ZONE
}

export interface Platform {
    id: string; // UUID
    name: string; // e.g., 'Mercari', 'eBay'
    base_fee_percentage: number; // e.g., 0.10 for 10%
    fixed_fee_local_currency: number; // 1取引あたり固定手数料（プラットフォーム通貨）例: eBay $0.30
    currency: string; // e.g., 'JPY', 'USD'
    created_at: string;
    updated_at: string;
}

export interface ExchangeRate {
    id: string; // UUID
    from_currency: string;
    to_currency: string;
    rate: number;
    created_at: string;
    updated_at: string;
}

export interface ShippingZone {
    id: string; // UUID
    name: string; // e.g., 'USA', 'Europe Zone 1'
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface ShippingRate {
    id: string; // UUID
    shipping_zone_id: string;
    min_weight_kg: number;
    max_weight_kg?: number; // NULL for highest tier
    cost_jpy: number;
    created_at: string;
    updated_at: string;
}

export interface CustomsDuty {
    id: string; // UUID
    hs_code_prefix: string;
    country_code: string; // ISO 3166-1 alpha-2
    duty_percentage: number;
    min_value_usd?: number;
    max_value_usd?: number;
    created_at: string;
    updated_at: string;
}

// --- Database Schema Interfaces (activity_logs & notification_logs) ---

export interface ActivityLog {
    id: string; // UUID
    timestamp: string;
    workflow_name: string;
    status: 'success' | 'failure' | 'skipped' | 'started' | 'finished' | 'emergency';
    message?: string;
    product_sku?: string;
    details?: Record<string, unknown>;
    created_at?: string;
}

export interface NotificationLog {
    id: string; // UUID
    timestamp: string;
    product_sku: string;
    platform: string;
    notified_price: number;
    notified_profit_margin: number;
    notification_method: string;
    message: string;
    dashboard_link?: string;
    created_at?: string;
}

// --- API Response Interfaces (Mocks) ---

export interface MercariProductApiResult {
    price: number; // JPY
    // other Mercari specific data
}

export interface YahooAuctionProductApiResult {
    price: number; // JPY
    // other Yahoo Auction specific data
}

export interface eBayProductApiResult {
    price: number; // USD (or other currency, but for simplicity assume USD for now)
    currency: string;
    // other eBay specific data
}

export interface StockXProductApiResult {
    price: number; // USD (or other currency)
    currency: string;
    // other StockX specific data
}

export interface FixerApiResponse {
    success: boolean;
    timestamp: number;
    base: string; // e.g., 'EUR'
    date: string;
    rates: {
        [currencyCode: string]: number; // e.g., { "JPY": 150.00, "USD": 1.08 }
    };
}

// --- Profit Calculation Specific Types ---

export type DomesticPlatform = 'Mercari' | 'Yahoo Auctions' | 'Rakuma' | 'PayPayフリマ';
export type OverseasPlatform = 'eBay' | 'StockX' | 'Amazon' | 'Mercari US';

export interface ProfitCalculationInput {
    productSku: string;
    domesticPlatform: DomesticPlatform;
    overseasPlatform: OverseasPlatform;
    targetSellingPriceOverseas: number;
    manualDomesticPrice?: number;
    destinationCountryCode: string;
}

export interface CalculatedProfitDetails {
    estimatedProfitJPY: number;
    profitMargin: number; // 純利益 ÷ 売上
    domesticPurchasePriceJPY: number;
    overseasSellingPriceLocalCurrency: number;
    overseasSellingPriceJPY: number;
    exchangeRate: number;
    internationalShippingCostJPY: number;
    customsDutyJPY: number;
    domesticPlatformFeeJPY: number;
    overseasPlatformFeeJPY: number;
}

export type DataSource = 'scraped' | 'mock' | 'api';

export interface MarketPriceItem {
    productSku?: string; // 内部商品SKUとの関連付け
    platformId?: string; // UUID from the platforms table
    platformName: DomesticPlatform | OverseasPlatform | string; // Name of the platform (e.g., 'Mercari')
    listingId?: string; // Unique ID for the listing on the platform
    title: string;
    price: number;
    currency: string;
    condition?: string;
    listingUrl: string;
    scrapedAt: string;
    imageUrl?: string; // Added for dashboard display
    dataSource: DataSource; // 'scraped' for real data, 'mock' for fallback data
}

// market_prices テーブルに対応するDBレコード型
export interface MarketPriceDbRecord {
    id: string;
    product_sku: string | null;
    platform_id: string;
    listing_id: string;
    title: string;
    price: number;
    currency: string;
    condition?: string;
    listing_url: string;
    scraped_at: string;
    image_url?: string;
    optimized_english_description?: string;
    optimal_price?: number;
    strategy?: string;
    profit_details?: CalculatedProfitDetails | Record<string, unknown>;
    profit_margin?: number;
    data_source: DataSource;
    search_keyword?: string | null;
    created_at: string;
    updated_at: string;
}

// --- AI Content Generation & Price Optimization Specific Types ---
export interface CompetitorPrice {
    platform: string; // e.g., 'eBay', 'StockX'
    price: number;
    currency: string;
    listingUrl?: string;
}

export interface OptimizeListingInput {
    productSku: string;
    productTitleJP: string; // Japanese product title
    productDescriptionJP: string; // Japanese product description
    productCategory: string; // Category for AI prompting
    currentCompetitorPrices: CompetitorPrice[];
    domesticPlatform?: DomesticPlatform; // e.g., 'Mercari' (default: 'Mercari')
    targetOverseasPlatform: OverseasPlatform; // e.g., 'eBay'
    destinationCountryCode: string; // e.g., 'US' for shipping/customs
    minProfitMarginPercentage?: number; // Optional: Override default min profit margin
}

export interface OptimizeListingOutput {
    optimizedSellingPrice: number; // In target overseas currency
    optimizedSellingPriceJPYEquivalent: number; // For logging/tracking
    optimizedEnglishDescription: string;
    currency: string; // Target overseas currency
    profitCalculationDetails: CalculatedProfitDetails; // From Step 2
    pricingStrategyUsed: string; // e.g., "UndercutLowestCompetitor", "MaintainMinProfit"
}

// For logging price changes
export interface PriceChangeLog {
    timestamp: string;
    productSku: string;
    platform: string;
    oldPrice: number;
    newPrice: number;
    currency: string;
    reason: string; // e.g., "Undercut competitor", "Maintain min profit"
    details?: string; // Additional context
}


// --- StockX Types ---
export interface StockXPriceItem {
    price: number;
    currency: string;
}

export interface StockXPricesWithSource {
    items: StockXPriceItem[];
    dataSource: DataSource;
}

// --- Mercari US Types ---
export interface MercariUsPriceItem {
    price: number;
    currency: string;
}

export interface MercariUsPricesWithSource {
    items: MercariUsPriceItem[];
    dataSource: DataSource;
}

export class ProfitCalculationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProfitCalculationError";
    }
}
