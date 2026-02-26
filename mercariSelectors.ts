// mercariSelectors.ts
export const MERCARI_SEARCH_SELECTORS = {
    // Selector for each individual product listing in the search results
    PRODUCT_LISTING: 'li[data-testid="item-cell"]', // Common pattern for list items containing products

    // Selectors relative to a single PRODUCT_LISTING
    TITLE: '[data-testid="thumbnail-item-name"]',
    PRICE: '.merPrice',
    LINK: 'a[data-testid="thumbnail-link"]',
    IMAGE: 'img',

    // Mercari doesn't always show condition on search result page, might need to go to product page
    // For now, we'll assume it's not directly available on search result.
    // If it were, it might be something like:
    // CONDITION: 'div.item-info__status',

    // Pagination (if needed)
    NEXT_PAGE_BUTTON: 'button[aria-label="次へ"]',
};

// Base URL for Mercari search
export const MERCARI_BASE_SEARCH_URL = (keyword: string) =>
    `https://jp.mercari.com/search?keyword=${encodeURIComponent(keyword)}`;

// Helper to clean and convert price text to number
export const cleanMercariPrice = (priceText: string): number => {
    // Remove currency symbols, commas, and convert to number
    return parseFloat(priceText.replace(/[^0-9.]/g, ''));
};
