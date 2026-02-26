// yahooAuctionsSelectors.ts
export const YAHOO_AUCTIONS_SEARCH_SELECTORS = {
    PRODUCT_LISTING: '.Product',
    TITLE: '.Product__title a',
    PRICE: '.Product__priceValue',
    LINK: '.Product__titleLink',
    IMAGE: '.Product__imageData img',
};

export const YAHOO_AUCTIONS_BASE_SEARCH_URL = (keyword: string) =>
    `https://auctions.yahoo.co.jp/search/search?p=${encodeURIComponent(keyword)}&va=${encodeURIComponent(keyword)}&exflg=1&b=1&n=20`;

export const cleanYahooAuctionsPrice = (priceText: string): number =>
    parseFloat(priceText.replace(/[^0-9.]/g, ''));
