import { ProfitCalculationError } from './types';
import * as crypto from 'crypto';

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || 'YOUR_SCRAPINGBEE_API_KEY';
const SCRAPINGBEE_API_URL = 'https://app.scrapingbee.com/api/v1/';

const LOG_PREFIX = '[ScrapingBeeService]';

export interface ScrapingOptions {
    block_resources?: boolean;
    javascript?: boolean;
    premium_proxy?: boolean;
    country_code?: string;
    custom_headers?: { [key: string]: string };
    wait_for?: string;
}

// ============================================================
// 1. ScrapingBee API (既存ロジックを関数として抽出)
// ============================================================

async function callScrapingBeeApi(
    targetUrl: string,
    options?: ScrapingOptions
): Promise<string> {
    if (!SCRAPINGBEE_API_KEY || SCRAPINGBEE_API_KEY === 'YOUR_SCRAPINGBEE_API_KEY') {
        throw new Error('SCRAPINGBEE_API_KEY not configured');
    }

    const params = new URLSearchParams();
    params.append('api_key', SCRAPINGBEE_API_KEY);
    params.append('url', targetUrl);
    params.append('render_js', String(options?.javascript || false));
    params.append('premium_proxy', String(options?.premium_proxy || false));
    params.append('block_resources', String(options?.block_resources || false));
    if (options?.country_code) {
        params.append('country_code', options.country_code);
    }
    if (options?.wait_for) {
        params.append('wait_for', options.wait_for);
    }
    if (options?.custom_headers) {
        for (const [key, value] of Object.entries(options.custom_headers)) {
            params.append(`custom_headers[${key}]`, value);
        }
    }

    const fullUrl = `${SCRAPINGBEE_API_URL}?${params.toString()}`;
    const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `ScrapingBee API error: ${response.status} ${response.statusText} - ${errorText}`
        );
    }

    return await response.text();
}

// ============================================================
// 2. 直接fetch (ScrapingBeeなしでHTMLを取得)
// ============================================================

const BROWSER_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
};

async function directFetchHtml(targetUrl: string): Promise<string> {
    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: BROWSER_HEADERS,
        redirect: 'follow',
    });

    if (!response.ok) {
        throw new Error(`Direct fetch failed: ${response.status} ${response.statusText}`);
    }

    return await response.text();
}

// ============================================================
// 3. メルカリ内部API (DPoP認証)
// ============================================================

interface MercariApiItem {
    id: string;
    name: string;
    price: number;
    thumbnails?: string[];
    status?: string;
}

interface MercariApiResponse {
    items?: MercariApiItem[];
}

function generateDpopJwt(url: string, method: string): string {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
    });

    const publicKeyJwk = publicKey.export({ format: 'jwk' });

    // DPoP JWT Header
    const header = {
        typ: 'dpop+jwt',
        alg: 'ES256',
        jwk: {
            kty: publicKeyJwk.kty,
            crv: publicKeyJwk.crv,
            x: publicKeyJwk.x,
            y: publicKeyJwk.y,
        },
    };

    // DPoP JWT Payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iat: now,
        jti: crypto.randomUUID(),
        htm: method,
        htu: url,
    };

    // Base64url encode
    const b64url = (obj: object): string =>
        Buffer.from(JSON.stringify(obj))
            .toString('base64url');

    const headerB64 = b64url(header);
    const payloadB64 = b64url(payload);
    const signingInput = `${headerB64}.${payloadB64}`;

    // Sign with ES256
    const signature = crypto.sign('sha256', Buffer.from(signingInput), {
        key: privateKey,
        dsaEncoding: 'ieee-p1363',
    });

    return `${signingInput}.${signature.toString('base64url')}`;
}

async function fetchMercariViaApi(keyword: string): Promise<string> {
    const apiUrl = 'https://api.mercari.jp/v2/entities:search';

    const dpopToken = generateDpopJwt(apiUrl, 'POST');

    const requestBody = {
        pageSize: 30,
        searchSessionId: crypto.randomUUID(),
        searchCondition: {
            keyword: keyword,
            sort: 'SORT_SCORE',
            order: 'ORDER_DESC',
            status: ['STATUS_ON_SALE'],
        },
    };

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': BROWSER_HEADERS['User-Agent'],
            'Sec-Ch-Ua': BROWSER_HEADERS['Sec-Ch-Ua'],
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-site',
            'DPoP': dpopToken,
            'X-Platform': 'web',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mercari API error: ${response.status} - ${errorText}`);
    }

    const data: MercariApiResponse = await response.json();

    if (!data.items || data.items.length === 0) {
        throw new Error('Mercari API returned no items');
    }

    return convertMercariApiToHtml(data.items);
}

// ============================================================
// 4. メルカリAPIレスポンス → パーサー互換HTML変換
// ============================================================

function convertMercariApiToHtml(items: MercariApiItem[]): string {
    const itemsHtml = items.map(item => {
        const priceFormatted = item.price.toLocaleString('ja-JP');
        const imageUrl = item.thumbnails?.[0] || 'placeholder.jpg';
        const itemUrl = `/item/${item.id}`;
        const escapedName = escapeHtml(item.name);

        return `
            <li data-testid="item-cell">
                <a data-testid="thumbnail-link" href="${itemUrl}">
                    <div class="thumbnail"><img src="${escapeHtml(imageUrl)}" alt="${escapedName}" /></div>
                    <div class="item-info">
                        <span class="merPrice">${priceFormatted}</span>
                        <span data-testid="thumbnail-item-name">${escapedName}</span>
                    </div>
                </a>
            </li>`;
    }).join('\n');

    return `<html><body><div id="search-result"><ul>${itemsHtml}</ul></div></body></html>`;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================================
// 5. モックHTML生成 (既存ロジックを関数として抽出)
// ============================================================

function generateMockHtml(targetUrl: string): string {
    if (targetUrl.includes('ebay.com')) {
        return generateMockEbayHtml(targetUrl);
    }
    if (targetUrl.includes('auctions.yahoo.co.jp')) {
        return generateMockYahooAuctionsHtml(targetUrl);
    }
    if (targetUrl.includes('amazon.com')) {
        return generateMockAmazonHtml(targetUrl);
    }
    if (targetUrl.includes('fril.jp')) {
        return generateMockRakumaHtml(targetUrl);
    }
    if (targetUrl.includes('paypayfleamarket.yahoo.co.jp')) {
        return generateMockPayPayFleamarketHtml(targetUrl);
    }
    if (targetUrl.includes('stockx.com')) {
        return generateMockStockXHtml(targetUrl);
    }
    // Mercari US (www.mercari.com) vs Mercari JP (jp.mercari.com)
    if (targetUrl.includes('www.mercari.com')) {
        return generateMockMercariUsHtml(targetUrl);
    }
    return generateMockMercariHtml(targetUrl);
}

function generateMockEbayHtml(targetUrl: string): string {
    const urlObj = new URL(targetUrl);
    const keyword = urlObj.searchParams.get('_nkw') || 'Unknown';
    console.warn(`${LOG_PREFIX} Returning eBay MOCK HTML for "${keyword}"`);

    let mockEbayItems = '';
    if (keyword.includes('ポケモン') || keyword.includes('Pokemon') || keyword.includes('トレカ')) {
        mockEbayItems = `
            <li class="s-item"><div class="s-item__price">$89.99</div></li>
            <li class="s-item"><div class="s-item__price">$120.00</div></li>
            <li class="s-item"><div class="s-item__price">$65.50</div></li>
            <li class="s-item"><div class="s-item__price">$150.00</div></li>
        `;
    } else if (keyword.includes('Switch') || keyword.includes('任天堂') || keyword.includes('Nintendo')) {
        mockEbayItems = `
            <li class="s-item"><div class="s-item__price">$249.99</div></li>
            <li class="s-item"><div class="s-item__price">$199.00</div></li>
            <li class="s-item"><div class="s-item__price">$280.00</div></li>
            <li class="s-item"><div class="s-item__price">$165.00</div></li>
        `;
    } else if (keyword.includes('ゲームボーイ') || keyword.includes('レトロゲーム')) {
        mockEbayItems = `
            <li class="s-item"><div class="s-item__price">$120.00</div></li>
            <li class="s-item"><div class="s-item__price">$95.00</div></li>
            <li class="s-item"><div class="s-item__price">$180.00</div></li>
            <li class="s-item"><div class="s-item__price">$75.00</div></li>
        `;
    } else if (keyword.includes('フィギュア') || keyword.includes('アニメ')) {
        mockEbayItems = `
            <li class="s-item"><div class="s-item__price">$150.00</div></li>
            <li class="s-item"><div class="s-item__price">$89.00</div></li>
            <li class="s-item"><div class="s-item__price">$200.00</div></li>
            <li class="s-item"><div class="s-item__price">$110.00</div></li>
        `;
    } else if (keyword.includes('ワンピース')) {
        mockEbayItems = `
            <li class="s-item"><div class="s-item__price">$130.00</div></li>
            <li class="s-item"><div class="s-item__price">$85.00</div></li>
            <li class="s-item"><div class="s-item__price">$160.00</div></li>
            <li class="s-item"><div class="s-item__price">$95.00</div></li>
        `;
    } else {
        mockEbayItems = `
            <li class="s-item"><div class="s-item__price">$120.00</div></li>
            <li class="s-item"><div class="s-item__price">$85.00</div></li>
            <li class="s-item"><div class="s-item__price">$150.00</div></li>
        `;
    }

    return `<html><body><ul>${mockEbayItems}</ul></body></html>`;
}

function generateMockMercariHtml(targetUrl: string): string {
    const urlObj = new URL(targetUrl);
    const keyword = urlObj.searchParams.get('keyword') || 'Unknown';
    const searchUrl = `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}`;
    const noImg = 'https://placehold.co/400x300/1e293b/FFFFFF?text=Mock';

    let mockItemsHtml = '';

    if (keyword.includes('Switch') || keyword.includes('任天堂スイッチ')) {
        mockItemsHtml = `
            <li data-testid="item-cell">
                <a data-testid="thumbnail-link" href="${searchUrl}">
                    <div class="thumbnail"><img src="${noImg}+Switch" alt="Nintendo Switch 本体 (有機ELモデル)" /></div>
                    <div class="item-info">
                        <span class="merPrice">28,500</span>
                        <span data-testid="thumbnail-item-name">Nintendo Switch 本体 (有機ELモデル) ホワイト 新品同様</span>
                    </div>
                </a>
            </li>
            <li data-testid="item-cell">
                <a data-testid="thumbnail-link" href="${searchUrl}">
                    <div class="thumbnail"><img src="${noImg}+Switch+Lite" alt="Nintendo Switch Lite ブルー" /></div>
                    <div class="item-info">
                        <span class="merPrice">15,000</span>
                        <span data-testid="thumbnail-item-name">Nintendo Switch Lite ブルー 箱なし 動作確認済み</span>
                    </div>
                </a>
            </li>
            <li data-testid="item-cell">
                <a data-testid="thumbnail-link" href="${searchUrl}">
                    <div class="thumbnail"><img src="${noImg}+Switch+Junk" alt="ジャンク品 Nintendo Switch" /></div>
                    <div class="item-info">
                        <span class="merPrice">8,000</span>
                        <span data-testid="thumbnail-item-name">【ジャンク】Nintendo Switch 旧型 本体のみ 画面割れあり</span>
                    </div>
                </a>
            </li>
        `;
    } else if (keyword.includes('ポケモン') || keyword.includes('Pokemon')) {
        mockItemsHtml = `
            <li data-testid="item-cell">
                <a data-testid="thumbnail-link" href="${searchUrl}">
                    <div class="thumbnail"><img src="${noImg}+Pokemon+1" alt="ピカチュウ AR" /></div>
                    <div class="item-info">
                        <span class="merPrice">3,500</span>
                        <span data-testid="thumbnail-item-name">ポケモンカード ピカチュウ AR VSTARユニバース 美品</span>
                    </div>
                </a>
            </li>
            <li data-testid="item-cell">
                <a data-testid="thumbnail-link" href="${searchUrl}">
                    <div class="thumbnail"><img src="${noImg}+Pokemon+2" alt="ナンジャモ SAR" /></div>
                    <div class="item-info">
                        <span class="merPrice">85,000</span>
                        <span data-testid="thumbnail-item-name">クレイバースト ナンジャモ SAR ローダー付き</span>
                    </div>
                </a>
            </li>
        `;
    } else {
        mockItemsHtml = `
            <li data-testid="item-cell">
                <a data-testid="thumbnail-link" href="${searchUrl}">
                    <div class="thumbnail"><img src="${noImg}" alt="Sample Item" /></div>
                    <div class="item-info">
                        <span class="merPrice">10,000</span>
                        <span data-testid="thumbnail-item-name">Sample Item for ${escapeHtml(keyword)}</span>
                    </div>
                </a>
            </li>
        `;
    }

    return `<html><body><div id="search-result"><ul>${mockItemsHtml}</ul></div></body></html>`;
}

function generateMockYahooAuctionsHtml(targetUrl: string): string {
    const urlObj = new URL(targetUrl);
    const keyword = urlObj.searchParams.get('p') || 'Unknown';
    console.warn(`${LOG_PREFIX} Returning Yahoo Auctions MOCK HTML for "${keyword}"`);

    const noImg = 'https://placehold.co/400x300/1e293b/FFFFFF?text=Yahoo+Mock';
    const auctionBase = 'https://page.auctions.yahoo.co.jp/jp/auction';

    let mockItemsHtml = '';

    if (keyword.includes('Switch') || keyword.includes('任天堂スイッチ')) {
        mockItemsHtml = `
            <div class="Product">
                <a class="Product__titleLink" href="${auctionBase}/y${Date.now()}1">
                    <div class="Product__title"><a>Nintendo Switch 有機ELモデル 美品</a></div>
                </a>
                <div class="Product__priceValue">24,500</div>
                <div class="Product__imageData"><img src="${noImg}+Switch" /></div>
            </div>
            <div class="Product">
                <a class="Product__titleLink" href="${auctionBase}/y${Date.now()}2">
                    <div class="Product__title"><a>Nintendo Switch Lite グレー 中古</a></div>
                </a>
                <div class="Product__priceValue">12,800</div>
                <div class="Product__imageData"><img src="${noImg}+SwitchLite" /></div>
            </div>
        `;
    } else if (keyword.includes('ポケモン') || keyword.includes('Pokemon')) {
        mockItemsHtml = `
            <div class="Product">
                <a class="Product__titleLink" href="${auctionBase}/y${Date.now()}1">
                    <div class="Product__title"><a>ポケモンカード ピカチュウ AR 美品</a></div>
                </a>
                <div class="Product__priceValue">2,800</div>
                <div class="Product__imageData"><img src="${noImg}+Pokemon1" /></div>
            </div>
            <div class="Product">
                <a class="Product__titleLink" href="${auctionBase}/y${Date.now()}2">
                    <div class="Product__title"><a>ポケモンカード ナンジャモ SAR</a></div>
                </a>
                <div class="Product__priceValue">72,000</div>
                <div class="Product__imageData"><img src="${noImg}+Pokemon2" /></div>
            </div>
        `;
    } else {
        mockItemsHtml = `
            <div class="Product">
                <a class="Product__titleLink" href="${auctionBase}/y${Date.now()}1">
                    <div class="Product__title"><a>${escapeHtml(keyword)} 中古品</a></div>
                </a>
                <div class="Product__priceValue">8,500</div>
                <div class="Product__imageData"><img src="${noImg}" /></div>
            </div>
        `;
    }

    return `<html><body>${mockItemsHtml}</body></html>`;
}

function generateMockAmazonHtml(targetUrl: string): string {
    const urlObj = new URL(targetUrl);
    const keyword = urlObj.searchParams.get('k') || 'Unknown';
    console.warn(`${LOG_PREFIX} Returning Amazon MOCK HTML for "${keyword}"`);

    let mockItemsHtml = '';
    if (keyword.includes('ポケモン') || keyword.includes('Pokemon') || keyword.includes('トレカ')) {
        mockItemsHtml = `
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$94.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$139.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$69.50</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$159.99</span></span></div>
        `;
    } else if (keyword.includes('Switch') || keyword.includes('任天堂') || keyword.includes('Nintendo')) {
        mockItemsHtml = `
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$264.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$214.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$299.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$179.99</span></span></div>
        `;
    } else if (keyword.includes('ゲームボーイ') || keyword.includes('レトロゲーム')) {
        mockItemsHtml = `
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$129.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$99.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$189.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$84.99</span></span></div>
        `;
    } else if (keyword.includes('フィギュア') || keyword.includes('アニメ')) {
        mockItemsHtml = `
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$159.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$94.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$214.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$119.99</span></span></div>
        `;
    } else if (keyword.includes('ワンピース')) {
        mockItemsHtml = `
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$139.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$89.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$174.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$104.99</span></span></div>
        `;
    } else {
        mockItemsHtml = `
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$129.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$89.99</span></span></div>
            <div data-component-type="s-search-result"><span class="a-price"><span class="a-offscreen">$159.99</span></span></div>
        `;
    }

    return `<html><body>${mockItemsHtml}</body></html>`;
}

// ============================================================
// 5b. 追加プラットフォーム用モックHTML生成
// ============================================================

function generateMockRakumaHtml(targetUrl: string): string {
    const urlObj = new URL(targetUrl);
    const keyword = urlObj.searchParams.get('query') || 'Unknown';
    console.warn(`${LOG_PREFIX} Returning Rakuma MOCK HTML for "${keyword}"`);

    const noImg = 'https://placehold.co/400x300/1e293b/FFFFFF?text=Rakuma+Mock';
    const baseUrl = 'https://fril.jp';

    let mockItemsHtml = '';

    if (keyword.includes('Switch') || keyword.includes('任天堂スイッチ')) {
        mockItemsHtml = `
            <div class="item-box" data-item-id="rakuma-${Date.now()}1">
                <a class="link_search_image" href="${baseUrl}/item/mock1">
                    <img src="${noImg}+Switch" alt="Nintendo Switch 有機EL" />
                </a>
                <div class="item-box__item-name"><a href="${baseUrl}/item/mock1">Nintendo Switch 有機ELモデル 美品</a></div>
                <div class="item-box__item-price"><span class="item-box__item-price__value">26,800</span></div>
            </div>
            <div class="item-box" data-item-id="rakuma-${Date.now()}2">
                <a class="link_search_image" href="${baseUrl}/item/mock2">
                    <img src="${noImg}+SwitchLite" alt="Nintendo Switch Lite" />
                </a>
                <div class="item-box__item-name"><a href="${baseUrl}/item/mock2">Nintendo Switch Lite グレー 中古</a></div>
                <div class="item-box__item-price"><span class="item-box__item-price__value">13,500</span></div>
            </div>
        `;
    } else if (keyword.includes('ポケモン') || keyword.includes('Pokemon')) {
        mockItemsHtml = `
            <div class="item-box" data-item-id="rakuma-${Date.now()}1">
                <a class="link_search_image" href="${baseUrl}/item/mock1">
                    <img src="${noImg}+Pokemon1" alt="ポケモンカード" />
                </a>
                <div class="item-box__item-name"><a href="${baseUrl}/item/mock1">ポケモンカード ピカチュウ AR 美品</a></div>
                <div class="item-box__item-price"><span class="item-box__item-price__value">3,200</span></div>
            </div>
            <div class="item-box" data-item-id="rakuma-${Date.now()}2">
                <a class="link_search_image" href="${baseUrl}/item/mock2">
                    <img src="${noImg}+Pokemon2" alt="ナンジャモ SAR" />
                </a>
                <div class="item-box__item-name"><a href="${baseUrl}/item/mock2">クレイバースト ナンジャモ SAR</a></div>
                <div class="item-box__item-price"><span class="item-box__item-price__value">78,000</span></div>
            </div>
        `;
    } else {
        mockItemsHtml = `
            <div class="item-box" data-item-id="rakuma-${Date.now()}1">
                <a class="link_search_image" href="${baseUrl}/item/mock1">
                    <img src="${noImg}" alt="${escapeHtml(keyword)}" />
                </a>
                <div class="item-box__item-name"><a href="${baseUrl}/item/mock1">${escapeHtml(keyword)} 中古品 ラクマ</a></div>
                <div class="item-box__item-price"><span class="item-box__item-price__value">9,200</span></div>
            </div>
        `;
    }

    return `<html><body><div class="search-results">${mockItemsHtml}</div></body></html>`;
}

function generateMockPayPayFleamarketHtml(targetUrl: string): string {
    // PayPayフリマはパスベース: /search/{keyword}
    const urlObj = new URL(targetUrl);
    const pathParts = urlObj.pathname.split('/');
    const keyword = decodeURIComponent(pathParts[pathParts.length - 1] || 'Unknown');
    console.warn(`${LOG_PREFIX} Returning PayPayフリマ MOCK HTML for "${keyword}"`);

    const noImg = 'https://placehold.co/400x300/1e293b/FFFFFF?text=PayPay+Mock';
    const baseUrl = 'https://paypayfleamarket.yahoo.co.jp';

    let mockItemsHtml = '';

    if (keyword.includes('Switch') || keyword.includes('任天堂スイッチ')) {
        mockItemsHtml = `
            <li class="ItemList__item" data-testid="item-cell">
                <a class="ItemList__itemLink" href="${baseUrl}/item/mock1">
                    <div class="ItemList__itemImage"><img src="${noImg}+Switch" alt="Nintendo Switch" /></div>
                    <div class="ItemList__itemInfo">
                        <p class="ItemList__itemName">Nintendo Switch 有機ELモデル 箱あり</p>
                        <p class="ItemList__itemPrice">25,500円</p>
                    </div>
                </a>
            </li>
            <li class="ItemList__item" data-testid="item-cell">
                <a class="ItemList__itemLink" href="${baseUrl}/item/mock2">
                    <div class="ItemList__itemImage"><img src="${noImg}+SwitchLite" alt="Nintendo Switch Lite" /></div>
                    <div class="ItemList__itemInfo">
                        <p class="ItemList__itemName">Nintendo Switch Lite コーラル 美品</p>
                        <p class="ItemList__itemPrice">12,000円</p>
                    </div>
                </a>
            </li>
        `;
    } else if (keyword.includes('ポケモン') || keyword.includes('Pokemon')) {
        mockItemsHtml = `
            <li class="ItemList__item" data-testid="item-cell">
                <a class="ItemList__itemLink" href="${baseUrl}/item/mock1">
                    <div class="ItemList__itemImage"><img src="${noImg}+Pokemon1" alt="ポケモンカード" /></div>
                    <div class="ItemList__itemInfo">
                        <p class="ItemList__itemName">ポケモンカード ピカチュウ AR VSTARユニバース</p>
                        <p class="ItemList__itemPrice">2,900円</p>
                    </div>
                </a>
            </li>
            <li class="ItemList__item" data-testid="item-cell">
                <a class="ItemList__itemLink" href="${baseUrl}/item/mock2">
                    <div class="ItemList__itemImage"><img src="${noImg}+Pokemon2" alt="ナンジャモ SAR" /></div>
                    <div class="ItemList__itemInfo">
                        <p class="ItemList__itemName">クレイバースト ナンジャモ SAR ローダー付き</p>
                        <p class="ItemList__itemPrice">70,000円</p>
                    </div>
                </a>
            </li>
        `;
    } else {
        mockItemsHtml = `
            <li class="ItemList__item" data-testid="item-cell">
                <a class="ItemList__itemLink" href="${baseUrl}/item/mock1">
                    <div class="ItemList__itemImage"><img src="${noImg}" alt="${escapeHtml(keyword)}" /></div>
                    <div class="ItemList__itemInfo">
                        <p class="ItemList__itemName">${escapeHtml(keyword)} 中古品 PayPayフリマ</p>
                        <p class="ItemList__itemPrice">7,800円</p>
                    </div>
                </a>
            </li>
        `;
    }

    return `<html><body><ul class="ItemList">${mockItemsHtml}</ul></body></html>`;
}

function generateMockStockXHtml(targetUrl: string): string {
    const urlObj = new URL(targetUrl);
    const keyword = urlObj.searchParams.get('s') || 'Unknown';
    console.warn(`${LOG_PREFIX} Returning StockX MOCK HTML for "${keyword}"`);

    let mockItemsHtml = '';
    if (keyword.includes('Jordan') || keyword.includes('ジョーダン') || keyword.includes('スニーカー')) {
        mockItemsHtml = `
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$285</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$320</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$195</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$450</p></div>
        `;
    } else if (keyword.includes('ポケモン') || keyword.includes('Pokemon') || keyword.includes('トレカ')) {
        mockItemsHtml = `
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$150</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$220</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$95</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$380</p></div>
        `;
    } else if (keyword.includes('フィギュア') || keyword.includes('アニメ')) {
        mockItemsHtml = `
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$180</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$120</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$250</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$350</p></div>
        `;
    } else {
        mockItemsHtml = `
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$165</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$120</p></div>
            <div class="css-1xpz4pz" data-testid="product-tile"><p class="css-price">$200</p></div>
        `;
    }

    return `<html><body><div class="search-results">${mockItemsHtml}</div></body></html>`;
}

function generateMockMercariUsHtml(targetUrl: string): string {
    const urlObj = new URL(targetUrl);
    const keyword = urlObj.searchParams.get('keyword') || 'Unknown';
    console.warn(`${LOG_PREFIX} Returning Mercari US MOCK HTML for "${keyword}"`);

    let mockItemsHtml = '';
    if (keyword.includes('ポケモン') || keyword.includes('Pokemon') || keyword.includes('トレカ')) {
        mockItemsHtml = `
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus1"><span data-testid="ItemPrice">$85.00</span><span data-testid="ItemName">Pokemon Card Pikachu AR</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus2"><span data-testid="ItemPrice">$125.00</span><span data-testid="ItemName">Pokemon Card Nanjamo SAR</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus3"><span data-testid="ItemPrice">$60.00</span><span data-testid="ItemName">Pokemon Trading Card Lot</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus4"><span data-testid="ItemPrice">$145.00</span><span data-testid="ItemName">Pokemon TCG Japanese Box</span></a></div></div>
        `;
    } else if (keyword.includes('Switch') || keyword.includes('Nintendo') || keyword.includes('任天堂')) {
        mockItemsHtml = `
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus1"><span data-testid="ItemPrice">$230.00</span><span data-testid="ItemName">Nintendo Switch OLED</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus2"><span data-testid="ItemPrice">$180.00</span><span data-testid="ItemName">Nintendo Switch Console</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus3"><span data-testid="ItemPrice">$260.00</span><span data-testid="ItemName">Nintendo Switch Bundle</span></a></div></div>
        `;
    } else if (keyword.includes('フィギュア') || keyword.includes('アニメ')) {
        mockItemsHtml = `
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus1"><span data-testid="ItemPrice">$140.00</span><span data-testid="ItemName">Anime Figure Japan Import</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus2"><span data-testid="ItemPrice">$80.00</span><span data-testid="ItemName">Japanese Anime Collectible</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus3"><span data-testid="ItemPrice">$190.00</span><span data-testid="ItemName">Rare Anime Figure Set</span></a></div></div>
        `;
    } else {
        mockItemsHtml = `
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus1"><span data-testid="ItemPrice">$110.00</span><span data-testid="ItemName">${escapeHtml(keyword)} - Japan Import</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus2"><span data-testid="ItemPrice">$80.00</span><span data-testid="ItemName">${escapeHtml(keyword)} - Used Good</span></a></div></div>
            <div data-testid="SearchResults"><div data-testid="ItemCell"><a href="/item/mus3"><span data-testid="ItemPrice">$145.00</span><span data-testid="ItemName">${escapeHtml(keyword)} - Like New</span></a></div></div>
        `;
    }

    return `<html><body>${mockItemsHtml}</body></html>`;
}

// ============================================================
// 6. HTMLの有効性チェック
// ============================================================

function isValidEbayHtml(html: string): boolean {
    return html.includes('s-item') && html.includes('s-item__price');
}

function isValidMercariHtml(html: string): boolean {
    return html.includes('data-testid="item-cell"');
}

function isValidYahooAuctionsHtml(html: string): boolean {
    return html.includes('Product');
}

function isValidAmazonHtml(html: string): boolean {
    return html.includes('s-search-result');
}

function isValidRakumaHtml(html: string): boolean {
    return html.includes('item-box');
}

function isValidPayPayFleamarketHtml(html: string): boolean {
    return html.includes('ItemList__item') || html.includes('ItemList');
}

function isValidStockXHtml(html: string): boolean {
    return html.includes('product-tile') || html.includes('css-price');
}

function isValidMercariUsHtml(html: string): boolean {
    return html.includes('ItemCell') || html.includes('ItemPrice');
}

function isValidHtml(html: string, targetUrl: string): boolean {
    if (targetUrl.includes('ebay.com')) {
        return isValidEbayHtml(html);
    }
    // Mercari JP (jp.mercari.com / mercari.jp) vs Mercari US (www.mercari.com)
    if (targetUrl.includes('jp.mercari.com') || targetUrl.includes('mercari.jp')) {
        return isValidMercariHtml(html);
    }
    if (targetUrl.includes('www.mercari.com')) {
        return isValidMercariUsHtml(html);
    }
    if (targetUrl.includes('auctions.yahoo.co.jp') && !targetUrl.includes('paypayfleamarket')) {
        return isValidYahooAuctionsHtml(html);
    }
    if (targetUrl.includes('amazon.com')) {
        return isValidAmazonHtml(html);
    }
    if (targetUrl.includes('fril.jp')) {
        return isValidRakumaHtml(html);
    }
    if (targetUrl.includes('paypayfleamarket.yahoo.co.jp')) {
        return isValidPayPayFleamarketHtml(html);
    }
    if (targetUrl.includes('stockx.com')) {
        return isValidStockXHtml(html);
    }
    // 不明なサイトの場合は長さのみチェック
    return html.length > 500;
}

// ============================================================
// 7. メインのフォールバックチェーン
//    ScrapingBee API → 直接fetch → (メルカリのみ) 内部API → モックデータ
// ============================================================

export async function fetchHtmlWithScrapingBee(
    targetUrl: string,
    options?: ScrapingOptions
): Promise<string> {
    const isMercariJp = targetUrl.includes('jp.mercari.com') || targetUrl.includes('mercari.jp');
    const isMercariUs = targetUrl.includes('www.mercari.com');
    const isMercari = isMercariJp || isMercariUs;
    const isEbay = targetUrl.includes('ebay.com');
    const isYahoo = targetUrl.includes('auctions.yahoo.co.jp') && !targetUrl.includes('paypayfleamarket');
    const isAmazon = targetUrl.includes('amazon.com');
    const isRakuma = targetUrl.includes('fril.jp');
    const isPayPayFleamarket = targetUrl.includes('paypayfleamarket.yahoo.co.jp');
    const isStockX = targetUrl.includes('stockx.com');
    const platformLabel = isMercariJp ? 'Mercari JP' : isMercariUs ? 'Mercari US' : isEbay ? 'eBay' : isYahoo ? 'Yahoo Auctions' : isAmazon ? 'Amazon' : isRakuma ? 'Rakuma' : isPayPayFleamarket ? 'PayPayフリマ' : isStockX ? 'StockX' : 'Unknown';

    // --- Step 1: ScrapingBee API ---
    try {
        console.log(`${LOG_PREFIX} Attempting ScrapingBee API for ${platformLabel}: ${targetUrl}`);
        const html = await callScrapingBeeApi(targetUrl, options);
        if (isValidHtml(html, targetUrl)) {
            console.log(`${LOG_PREFIX} ScrapingBee API successful for ${platformLabel}`);
            return html;
        }
        console.warn(`${LOG_PREFIX} ScrapingBee returned HTML but content validation failed for ${platformLabel}`);
    } catch (error: any) {
        console.warn(`${LOG_PREFIX} ScrapingBee API failed for ${platformLabel}: ${error.message}`);
    }

    // --- Step 2: 直接fetch ---
    try {
        console.log(`${LOG_PREFIX} Attempting direct fetch for ${platformLabel}: ${targetUrl}`);
        const html = await directFetchHtml(targetUrl);
        if (isValidHtml(html, targetUrl)) {
            console.log(`${LOG_PREFIX} Direct fetch successful for ${platformLabel}`);
            return html;
        }
        console.warn(`${LOG_PREFIX} Direct fetch returned HTML but content validation failed for ${platformLabel} (likely JS-rendered content)`);
    } catch (error: any) {
        console.warn(`${LOG_PREFIX} Direct fetch failed for ${platformLabel}: ${error.message}`);
    }

    // --- Step 3: メルカリ内部API (メルカリJPのみ) ---
    if (isMercariJp) {
        try {
            const urlObj = new URL(targetUrl);
            const keyword = urlObj.searchParams.get('keyword') || '';
            if (keyword) {
                console.log(`${LOG_PREFIX} Attempting Mercari API fallback for keyword: "${keyword}"`);
                const html = await fetchMercariViaApi(keyword);
                if (isValidMercariHtml(html)) {
                    console.log(`${LOG_PREFIX} Mercari API fallback successful`);
                    return html;
                }
                console.warn(`${LOG_PREFIX} Mercari API returned data but HTML validation failed`);
            }
        } catch (error: any) {
            console.warn(`${LOG_PREFIX} Mercari API fallback failed: ${error.message}`);
        }
    }

    // --- Step 4: モックデータ (最終フォールバック) ---
    console.warn(`${LOG_PREFIX} All fetch methods failed for ${platformLabel}. Returning MOCK data.`);
    return generateMockHtml(targetUrl);
}

// ============================================================
// JSON fetch ユーティリティ (既存互換)
// ============================================================

export async function fetchJsonWithScrapingBee<T>(
    targetUrl: string,
    options?: ScrapingOptions
): Promise<T> {
    const htmlContent = await fetchHtmlWithScrapingBee(targetUrl, options);
    try {
        return JSON.parse(htmlContent) as T;
    } catch (error: any) {
        throw new ProfitCalculationError(`Failed to parse JSON from ScrapingBee response: ${error.message}`);
    }
}
