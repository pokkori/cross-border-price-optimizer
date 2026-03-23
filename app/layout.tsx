import './globals.css';
import ErrorBoundary from './ErrorBoundary';
import type { Metadata } from 'next';

const SITE_URL = 'https://ec-price-agent.vercel.app';
const TITLE = '越境EC価格最適化エージェント｜メルカリ×eBay・Amazon 利益計算AI';
const DESC = 'メルカリ・ヤフオク・楽天（国内）とeBay・Amazon・StockX（海外）を一括比較。送料・関税・手数料を自動計算し月¥10万の副業収入を実現するAIエージェント。月額¥4,980。';

export const metadata: Metadata = {
    title: TITLE,
    description: DESC,
    keywords: ['越境EC', '転売', 'eBay', 'Amazon', '価格比較', '利益計算', 'AI', '副業'],
    openGraph: {
        title: TITLE,
        description: DESC,
        url: SITE_URL,
        siteName: '越境EC価格最適化エージェント',
        locale: 'ja_JP',
        type: 'website',
        images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630, alt: '越境EC価格最適化エージェント' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: TITLE,
        description: DESC,
        images: [`${SITE_URL}/og-image.png`],
    },
    metadataBase: new URL(SITE_URL),
    robots: { index: true, follow: true },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body>
                <ErrorBoundary>{children}</ErrorBoundary>
            </body>
        </html>
    );
}
