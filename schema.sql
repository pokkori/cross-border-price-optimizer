-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(255),
    weight_kg DECIMAL(10, 3),
    length_cm DECIMAL(10, 3),
    width_cm DECIMAL(10, 3),
    height_cm DECIMAL(10, 3),
    hs_code VARCHAR(20),
    purchase_price DECIMAL(10, 2), -- 仕入れ価格 (JPY)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: platforms
CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    base_fee_percentage DECIMAL(5, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: exchange_rates
CREATE TABLE IF NOT EXISTS exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(18, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (from_currency, to_currency)
);

-- Table: shipping_zones
CREATE TABLE IF NOT EXISTS shipping_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: shipping_rates
CREATE TABLE IF NOT EXISTS shipping_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shipping_zone_id UUID NOT NULL,
    min_weight_kg DECIMAL(10, 3) NOT NULL,
    max_weight_kg DECIMAL(10, 3), -- NULL for highest tier
    cost_jpy DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Table: customs_duties
CREATE TABLE IF NOT EXISTS customs_duties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hs_code_prefix VARCHAR(20) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    duty_percentage DECIMAL(5, 4) NOT NULL,
    min_value_usd DECIMAL(10, 2),
    max_value_usd DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (hs_code_prefix, country_code)
);

-- Add Foreign Key Constraints
ALTER TABLE shipping_rates
ADD CONSTRAINT fk_shipping_zone
FOREIGN KEY (shipping_zone_id) REFERENCES shipping_zones(id)
ON DELETE CASCADE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products (sku);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency_pair ON exchange_rates (from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_zone_weight ON shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg);
CREATE INDEX IF NOT EXISTS idx_customs_duties_hs_country ON customs_duties (hs_code_prefix, country_code);

-- Set up row-level security (RLS) for Supabase, if needed
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shipping_zones ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE shipping_rates ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customs_duties ENABLE ROW LEVEL SECURITY;

-- Table: market_prices
CREATE TABLE IF NOT EXISTS market_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_sku VARCHAR(255), -- Nullable, as a scraped item might not immediately map to an internal product
    platform_id UUID NOT NULL,
    listing_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    condition VARCHAR(50),
    listing_url TEXT NOT NULL,
    scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    image_url TEXT,
    optimized_english_description TEXT,
    optimal_price DECIMAL(10, 2),
    strategy VARCHAR(100),
    profit_details JSONB,
    profit_margin DECIMAL(5, 4),
    data_source VARCHAR(20) DEFAULT 'scraped', -- 'scraped' or 'mock'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (platform_id, listing_id) -- A listing is unique per platform
);

-- Add Foreign Key Constraints for market_prices
ALTER TABLE market_prices
ADD CONSTRAINT fk_market_prices_product_sku
FOREIGN KEY (product_sku) REFERENCES products(sku)
ON DELETE SET NULL; -- If a product is deleted, set its SKU in market_prices to NULL

ALTER TABLE market_prices
ADD CONSTRAINT fk_market_prices_platform_id
FOREIGN KEY (platform_id) REFERENCES platforms(id)
ON DELETE CASCADE; -- If a platform is deleted, delete its market prices

-- Add indexes for performance on market_prices
CREATE INDEX IF NOT EXISTS idx_market_prices_product_sku ON market_prices (product_sku);
CREATE INDEX IF NOT EXISTS idx_market_prices_platform_id ON market_prices (platform_id);
CREATE INDEX IF NOT EXISTS idx_market_prices_scraped_at ON market_prices (scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_prices_price ON market_prices (price);

-- RLS for market_prices if needed
-- ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;

-- Table: activity_logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    workflow_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- e.g., 'success', 'failure', 'skipped'
    message TEXT,
    product_sku VARCHAR(255),
    details JSONB, -- For structured logging data
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for activity_logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_workflow_name ON activity_logs (workflow_name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_status ON activity_logs (status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_product_sku ON activity_logs (product_sku);
CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs (timestamp DESC);


-- Table: notification_logs
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    product_sku VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL, -- e.g., 'eBay'
    notified_price DECIMAL(10, 2) NOT NULL,
    notified_profit_margin DECIMAL(5, 4) NOT NULL,
    notification_method VARCHAR(50) NOT NULL, -- e.g., 'LINE', 'Slack'
    message TEXT NOT NULL,
    dashboard_link TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    -- Duplicate prevention is handled by application-level cooldown check (getRecentNotification)
);

-- Add Foreign Key Constraints for notification_logs
ALTER TABLE notification_logs
ADD CONSTRAINT fk_notification_logs_product_sku
FOREIGN KEY (product_sku) REFERENCES products(sku)
ON DELETE CASCADE; -- If a product is deleted, delete its notification logs

-- Add indexes for notification_logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_product_sku ON notification_logs (product_sku);
CREATE INDEX IF NOT EXISTS idx_notification_logs_timestamp ON notification_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_platform ON notification_logs (platform);

-- ============================================================
-- Row Level Security (RLS) 設定
-- ============================================================
-- アプリはサーバーサイドAPIルート経由でのみDBにアクセスする設計。
-- SUPABASE_SERVICE_ROLE_KEY を使用する場合は RLS をバイパスするため、
-- 以下のポリシーは anon キーによる直接アクセスの制限として機能する。
--
-- ⚠️ 実行方法: Supabase ダッシュボード > SQL Editor で手動実行する。
--    schema.sql の全実行ではなく、この RLS セクションだけを実行すること。
-- ============================================================

-- RLS を有効化
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_zones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_rates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customs_duties        ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_prices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs     ENABLE ROW LEVEL SECURITY;

-- 参照系テーブル: anon は読み取りのみ許可
-- （SUPABASE_SERVICE_ROLE_KEY 使用時は RLS をバイパスするため書き込みも可能）
CREATE POLICY IF NOT EXISTS "anon_read_products"         ON products         FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read_platforms"        ON platforms        FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read_exchange_rates"   ON exchange_rates   FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read_shipping_zones"   ON shipping_zones   FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read_shipping_rates"   ON shipping_rates   FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read_customs_duties"   ON customs_duties   FOR SELECT TO anon USING (true);

-- 書き込み系テーブル: anon は読み取りのみ（書き込みは Service Role 経由のみ）
CREATE POLICY IF NOT EXISTS "anon_read_market_prices"    ON market_prices    FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read_activity_logs"   ON activity_logs    FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read_notification_logs" ON notification_logs FOR SELECT TO anon USING (true);

-- Add fixed_fee_local_currency column to platforms (eBay $0.30/取引など)
ALTER TABLE platforms ADD COLUMN IF NOT EXISTS fixed_fee_local_currency DECIMAL(10, 2) DEFAULT 0;

-- Add analysis result columns to market_prices
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS optimized_english_description TEXT;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS optimal_price DECIMAL(10, 2);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS strategy VARCHAR(100);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS profit_details JSONB;
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(5, 4);
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS data_source VARCHAR(20) DEFAULT 'scraped'; -- 'scraped' or 'mock'
ALTER TABLE market_prices ADD COLUMN IF NOT EXISTS search_keyword VARCHAR(255); -- 分析時に指定したキーワード（おすすめ表示用）

-- ============================================================
-- Seed Data
-- ============================================================

-- Products
INSERT INTO products (sku, name, description, category, weight_kg, length_cm, width_cm, height_cm, hs_code, purchase_price)
VALUES
    ('GADGET-XYZ-001', 'Super Gadget XYZ', 'A high-tech gadget.', 'Electronics', 0.5, 20, 10, 5, '8517.12', 10000),
    ('VINTAGE-SHIRT-002', 'Vintage Band T-Shirt', 'Rare vintage t-shirt.', 'Apparel', 0.2, 30, 25, 2, '6109.10', 5000)
ON CONFLICT (sku) DO NOTHING;

-- Platforms
-- fixed_fee_local_currency: プラットフォーム通貨での1取引あたり固定手数料 (例: eBay $0.30)
INSERT INTO platforms (name, base_fee_percentage, currency, fixed_fee_local_currency)
VALUES
    ('Mercari',        0.1000, 'JPY', 0.00),
    ('Yahoo Auctions', 0.0880, 'JPY', 0.00),
    ('eBay',           0.1290, 'USD', 0.30),  -- 12.9% + $0.30/件 (Managed Payments)
    ('StockX',         0.1200, 'USD', 0.00),  -- 取引手数料9% + 決済手数料3% = 12%
    ('Rakuma',         0.0660, 'JPY', 0.00),
    ('PayPayフリマ',   0.0500, 'JPY', 0.00),
    ('Mercari US',     0.1000, 'USD', 0.00),
    ('Amazon',         0.1500, 'USD', 0.00)   -- カテゴリ依存(8〜45%)、コードで上書き
ON CONFLICT (name) DO UPDATE SET
    base_fee_percentage      = EXCLUDED.base_fee_percentage,
    fixed_fee_local_currency = EXCLUDED.fixed_fee_local_currency,
    updated_at               = NOW();

-- Exchange Rates
INSERT INTO exchange_rates (from_currency, to_currency, rate)
VALUES
    ('JPY', 'USD', 0.00670000),
    ('USD', 'JPY', 149.00000000)
ON CONFLICT (from_currency, to_currency) DO UPDATE SET rate = EXCLUDED.rate, updated_at = NOW();

-- Shipping Zones
INSERT INTO shipping_zones (name, description)
VALUES
    ('USA', 'United States of America'),
    ('Europe', 'Major European Countries')
ON CONFLICT (name) DO NOTHING;

-- Shipping Rates (reference zone IDs by subquery)
INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 0, 0.5, 2000 FROM shipping_zones z WHERE z.name = 'USA'
ON CONFLICT DO NOTHING;

INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 0.5, 1.0, 3500 FROM shipping_zones z WHERE z.name = 'USA'
ON CONFLICT DO NOTHING;

INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 1.0, 2.0, 5000 FROM shipping_zones z WHERE z.name = 'USA'
ON CONFLICT DO NOTHING;

INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 2.0, NULL, 7000 FROM shipping_zones z WHERE z.name = 'USA'
ON CONFLICT DO NOTHING;

-- Europe 送料（シミュレータで配送先に GB/DE/FR を選んだ場合に必要。既存レコードがある場合はスキップ）
INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 0, 0.5, 2500 FROM shipping_zones z WHERE z.name = 'Europe' AND NOT EXISTS (SELECT 1 FROM shipping_rates sr WHERE sr.shipping_zone_id = z.id AND sr.min_weight_kg = 0);
INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 0.5, 1.0, 4000 FROM shipping_zones z WHERE z.name = 'Europe' AND NOT EXISTS (SELECT 1 FROM shipping_rates sr WHERE sr.shipping_zone_id = z.id AND sr.min_weight_kg = 0.5);
INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 1.0, 2.0, 6000 FROM shipping_zones z WHERE z.name = 'Europe' AND NOT EXISTS (SELECT 1 FROM shipping_rates sr WHERE sr.shipping_zone_id = z.id AND sr.min_weight_kg = 1.0);
INSERT INTO shipping_rates (shipping_zone_id, min_weight_kg, max_weight_kg, cost_jpy)
SELECT z.id, 2.0, NULL, 8500 FROM shipping_zones z WHERE z.name = 'Europe' AND NOT EXISTS (SELECT 1 FROM shipping_rates sr WHERE sr.shipping_zone_id = z.id AND sr.min_weight_kg = 2.0);

-- Customs Duties
-- US de minimis (Section 321): $800以下は免税。min_value_usd=800 で閾値を設定。
INSERT INTO customs_duties (hs_code_prefix, country_code, duty_percentage, min_value_usd)
VALUES
    ('8517', 'US', 0.0250, 800),  -- 電子機器: $800超で2.5%
    ('6109', 'US', 0.1600, 800)   -- アパレル: $800超で16%
ON CONFLICT (hs_code_prefix, country_code) DO UPDATE SET
    duty_percentage = EXCLUDED.duty_percentage,
    min_value_usd   = EXCLUDED.min_value_usd,
    updated_at      = NOW();
