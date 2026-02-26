// paypayFleamarketSelectors.ts
export const PAYPAY_FLEAMARKET_SEARCH_SELECTORS = {
    PRODUCT_LISTING: '.ItemList__item, li[data-testid="item-cell"]',
    TITLE: '.ItemList__itemName',
    PRICE: '.ItemList__itemPrice',
    LINK: '.ItemList__itemLink, a',
    IMAGE: 'img',
};

// PayPayフリマ検索URL（パスベース）
export const PAYPAY_FLEAMARKET_BASE_SEARCH_URL = (keyword: string) =>
    `https://paypayfleamarket.yahoo.co.jp/search/${encodeURIComponent(keyword)}`;

// 価格テキストを数値に変換（「25,500円」→ 25500）
export const cleanPayPayFleamarketPrice = (priceText: string): number => {
    return parseFloat(priceText.replace(/[^0-9.]/g, ''));
};
