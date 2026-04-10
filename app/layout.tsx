import './globals.css';
import ErrorBoundary from './ErrorBoundary';
import type { Metadata } from 'next';

const SITE_URL = 'https://ekkyo-ec-agent.vercel.app';
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

const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "越境EC価格最適化エージェント",
    description: DESC,
    url: SITE_URL,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
        "@type": "Offer",
        price: "4980",
        priceCurrency: "JPY",
        billingPeriod: "P1M",
    },
    provider: {
        "@type": "Organization",
        name: "ポッコリラボ",
        contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            url: "https://twitter.com/levona_design",
        },
    },
};

const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
        {
            "@type": "Question",
            "name": "越境EC価格最適化エージェントとは何ですか？",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "メルカリ・ヤフオク（国内）とeBay・Amazon・StockX（海外）の価格を一括比較し、送料・関税・手数料を自動計算してAIが利益の出る商品を提案するサービスです。月額¥4,980で利用できます。"
            }
        },
        {
            "@type": "Question",
            "name": "初心者でも越境ECを始められますか？",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "はい。商品名やキーワードを入力するだけでAIが国内外の相場を分析し、利益率・仕入れ先・販売価格を提案します。越境EC未経験の方でも月¥10万の副業収入を目指せます。"
            }
        },
        {
            "@type": "Question",
            "name": "どのプラットフォームに対応していますか？",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "国内はメルカリ・ヤフオク・楽天、海外はeBay・Amazon・StockXに対応。送料・関税・各プラットフォームの手数料を自動計算します。"
            }
        },
        {
            "@type": "Question",
            "name": "料金はいくらですか？",
            "acceptedAnswer": {
                "@type": "Answer",
                "text": "月額¥4,980（税込）でご利用いただけます。初月は無料でお試しいただけます。"
            }
        },
    ]
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <head>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
                />
            </head>
            <body>
                <ErrorBoundary>{children}</ErrorBoundary>
            </body>
        </html>
    );
}
