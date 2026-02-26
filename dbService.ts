import {
    Platform,
    ExchangeRate,
    ShippingRate,
    CustomsDuty,
    Product,
    DomesticPlatform,
    OverseasPlatform,
    ProfitCalculationError,
    ActivityLog,
    NotificationLog,
    MarketPriceDbRecord
} from './types';
import { supabase } from './supabaseClient';

// --- Database Service Functions ---

export async function getProductBySku(sku: string): Promise<Product | null> {
    console.log(`[dbService] Fetching product with SKU: ${sku}`);
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('sku', sku)
        .single();

    if (error) {
        console.error(`[dbService] Error fetching product: ${error.message}`);
        return null;
    }
    return data;
}

export async function getPlatform(name: DomesticPlatform | OverseasPlatform | string): Promise<Platform | null> {
    console.log(`[dbService] Fetching platform: ${name}`);
    const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('name', name)
        .single();

    if (error) {
        console.error(`[dbService] Error fetching platform: ${error.message}`);
        return null;
    }
    return data;
}

export async function getExchangeRate(from: string, to: string): Promise<ExchangeRate | null> {
    console.log(`[dbService] Fetching exchange rate from ${from} to ${to}`);
    const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', from)
        .eq('to_currency', to)
        .single();

    if (error) {
        console.error(`[dbService] Error fetching exchange rate: ${error.message}`);
        return null;
    }
    return data;
}

export async function getShippingCost(
    productWeightKg: number,
    destinationCountryCode: string
): Promise<number> {
    console.log(`[dbService] Calculating shipping cost for ${productWeightKg}kg to ${destinationCountryCode}`);

    // Map country code to zone name
    const countryToZoneMap: Record<string, string> = {
        'US': 'USA',
        'USA': 'USA',
        'GB': 'Europe',
        'DE': 'Europe',
        'FR': 'Europe',
    };
    const zoneName = countryToZoneMap[destinationCountryCode] ?? 'USA';

    // Get shipping zone
    const { data: zone, error: zoneError } = await supabase
        .from('shipping_zones')
        .select('*')
        .eq('name', zoneName)
        .single();

    if (zoneError || !zone) {
        throw new ProfitCalculationError(`No shipping zone found for country code: ${destinationCountryCode}`);
    }

    // Get shipping rate for weight range
    const { data: rates, error: rateError } = await supabase
        .from('shipping_rates')
        .select('*')
        .eq('shipping_zone_id', zone.id)
        .lte('min_weight_kg', productWeightKg)
        .order('min_weight_kg', { ascending: false });

    if (rateError || !rates || rates.length === 0) {
        throw new ProfitCalculationError(
            `No shipping rate found for weight ${productWeightKg}kg to zone ${zoneName}`
        );
    }

    // Find the rate where weight falls within range
    const rate = rates.find((r: ShippingRate) =>
        productWeightKg >= r.min_weight_kg &&
        (r.max_weight_kg === null || r.max_weight_kg === undefined || productWeightKg < r.max_weight_kg)
    );

    if (!rate) {
        throw new ProfitCalculationError(
            `No shipping rate found for weight ${productWeightKg}kg to zone ${zoneName}`
        );
    }
    return rate.cost_jpy;
}

export async function getCustomsDuty(
    hsCode: string,
    destinationCountryCode: string,
    productValueUsd: number
): Promise<number> {
    console.log(`[dbService] Calculating customs duty for HS ${hsCode} to ${destinationCountryCode} (value: $${productValueUsd})`);

    // Fetch all duties for this country
    const { data: duties, error } = await supabase
        .from('customs_duties')
        .select('*')
        .eq('country_code', destinationCountryCode);

    if (error || !duties) {
        console.warn(`[dbService] Error fetching customs duties: ${error?.message}`);
        return 0;
    }

    // Filter by HS code prefix match in application code, sorted by specificity
    const relevantDuties = duties
        .filter((d: CustomsDuty) => hsCode.startsWith(d.hs_code_prefix))
        .sort((a: CustomsDuty, b: CustomsDuty) => b.hs_code_prefix.length - a.hs_code_prefix.length);

    for (const duty of relevantDuties) {
        const appliesByValue =
            (duty.min_value_usd === null || duty.min_value_usd === undefined || productValueUsd >= duty.min_value_usd) &&
            (duty.max_value_usd === null || duty.max_value_usd === undefined || productValueUsd <= duty.max_value_usd);

        if (appliesByValue) {
            return duty.duty_percentage;
        }
    }

    console.warn(`[dbService] No specific customs duty found for HS ${hsCode} to ${destinationCountryCode} within value range $${productValueUsd}. Assuming 0%.`);
    return 0;
}

// --- New functions for activity/notification logs and market prices ---

export async function upsertMarketPrice(data: Partial<MarketPriceDbRecord>): Promise<void> {
    const { error } = await supabase
        .from('market_prices')
        .upsert(data, { onConflict: 'platform_id,listing_id' });

    if (error) {
        throw new Error(`[dbService] Error upserting market price: ${error.message}`);
    }
}

export async function insertActivityLog(log: Omit<ActivityLog, 'id'>): Promise<void> {
    const { error } = await supabase
        .from('activity_logs')
        .insert(log);

    if (error) {
        // Activity log failures should not halt the workflow
        console.warn(`[dbService] Failed to insert activity log: ${error.message}`);
    }
}

export async function insertNotificationLog(log: Omit<NotificationLog, 'id'>): Promise<void> {
    const { error } = await supabase
        .from('notification_logs')
        .insert(log);

    if (error) {
        throw new Error(`[dbService] Error inserting notification log: ${error.message}`);
    }
}

export async function getRecentNotification(
    productSku: string,
    platform: string,
    cooldownHours: number
): Promise<boolean> {
    const cooldownPeriod = new Date(Date.now() - cooldownHours * 3600 * 1000).toISOString();

    const { data, error } = await supabase
        .from('notification_logs')
        .select('id')
        .eq('product_sku', productSku)
        .eq('platform', platform)
        .gte('timestamp', cooldownPeriod)
        .limit(1);

    if (error) {
        console.error(`[dbService] Error checking recent notification: ${error.message}`);
        return false;
    }

    return data !== null && data.length > 0;
}

export async function getCompetitorPrices(
    productSku: string,
    platformName: string
): Promise<{ platform: string; price: number; currency: string; listingUrl?: string }[]> {
    console.log(`[dbService] Fetching competitor prices for ${productSku} on ${platformName}`);

    // Get platform ID
    const { data: platform } = await supabase
        .from('platforms')
        .select('id, currency')
        .eq('name', platformName)
        .single();

    if (!platform) return [];

    const { data, error } = await supabase
        .from('market_prices')
        .select('price, currency, listing_url')
        .eq('product_sku', productSku)
        .eq('platform_id', platform.id)
        .eq('data_source', 'scraped')
        .order('scraped_at', { ascending: false })
        .limit(10);

    if (error || !data) return [];

    return data.map((row: any) => ({
        platform: platformName,
        price: row.price,
        currency: row.currency,
        listingUrl: row.listing_url,
    }));
}
