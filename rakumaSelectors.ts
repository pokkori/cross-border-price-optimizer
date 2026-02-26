// rakumaSelectors.ts
export const RAKUMA_SEARCH_SELECTORS = {
    PRODUCT_LISTING: '.item-box',
    TITLE: '.item-box__item-name a',
    PRICE: '.item-box__item-price__value',
    LINK: 'a.link_search_image',
    IMAGE: 'img',
};

// ラクマ検索URL（販売中のみ）
export const RAKUMA_BASE_SEARCH_URL = (keyword: string) =>
    `https://fril.jp/s?query=${encodeURIComponent(keyword)}&transaction=selling`;

// 価格テキストを数値に変換
export const cleanRakumaPrice = (priceText: string): number => {
    return parseFloat(priceText.replace(/[^0-9.]/g, ''));
};
