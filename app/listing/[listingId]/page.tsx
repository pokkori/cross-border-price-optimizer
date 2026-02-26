'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type ListingData = {
    listing_id: string;
    title: string;
    price: number;
    currency: string;
    optimal_price: number | null;
    optimized_english_description: string | null;
    listing_url: string;
    image_url: string | null;
    product_sku: string | null;
};

const EBAY_SELL_URL = 'https://www.ebay.com/sell';

export default function ListingHelperPage() {
    const params = useParams();
    const listingId = params?.listingId as string | undefined;
    const [data, setData] = useState<ListingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        if (!listingId) {
            setError('商品IDがありません');
            setLoading(false);
            return;
        }
        fetch(`/api/products/${encodeURIComponent(listingId)}`)
            .then((res) => {
                if (!res.ok) throw new Error(res.status === 404 ? '商品が見つかりません' : '取得に失敗しました');
                return res.json();
            })
            .then((json) => {
                if (json.success && json.data) setData(json.data);
                else throw new Error('データがありません');
            })
            .catch((e: Error) => setError(e.message))
            .finally(() => setLoading(false));
    }, [listingId]);

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(label);
            setTimeout(() => setCopied(null), 2000);
        } catch {
            setCopied(null);
        }
    };

    const title = data?.title ?? '';
    const price = data?.optimal_price ?? data?.price ?? 0;
    const currency = data?.currency ?? 'JPY';
    const desc = data?.optimized_english_description ?? '';
    const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(title)}`;

    const priceUsd = typeof data?.optimal_price === 'number' ? data.optimal_price : 0;
    const copyAll = () => {
        const lines = [
            `Title: ${title}`,
            `Price: ${priceUsd > 0 ? priceUsd.toFixed(2) : price} USD`,
            '',
            'Description:',
            desc,
            '',
            'Mercari: ' + (data?.listing_url ?? ''),
            'eBay search: ' + ebaySearchUrl,
        ];
        copyToClipboard(lines.join('\n'), 'all');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-[#0f172a] text-slate-200 flex flex-col items-center justify-center gap-4 p-4">
                <p className="text-rose-400">{error ?? '商品が見つかりません'}</p>
                <Link href="/dashboard" className="text-indigo-400 hover:underline text-sm font-bold">
                    ← ダッシュボードに戻る
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-slate-100">
            <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-10">
                <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm font-bold flex items-center gap-1">
                        ← ダッシュボード
                    </Link>
                    <h1 className="text-sm font-black text-indigo-300 uppercase tracking-wider">eBay 出品用</h1>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
                {/* 画像 */}
                {data.image_url && (
                    <div className="rounded-2xl overflow-hidden border border-slate-700">
                        <img src={data.image_url} alt={title} className="w-full h-48 object-cover" />
                    </div>
                )}

                {/* タイトル */}
                <section>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">タイトル</label>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(title, 'title')}
                            className="px-3 py-1 bg-slate-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            {copied === 'title' ? 'コピーしました' : 'コピー'}
                        </button>
                    </div>
                    <p className="text-slate-200 text-sm leading-relaxed break-words">{title}</p>
                </section>

                {/* 推奨価格 (USD) */}
                <section>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">推奨販売価格 (USD)</label>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(String(data.optimal_price ?? price), 'price')}
                            className="px-3 py-1 bg-slate-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            {copied === 'price' ? 'コピーしました' : 'コピー'}
                        </button>
                    </div>
                    <p className="text-indigo-300 font-mono font-bold text-lg">
                        ${typeof data.optimal_price === 'number' ? data.optimal_price.toFixed(2) : price}
                    </p>
                </section>

                {/* 英語説明文 */}
                <section>
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">英語説明文</label>
                        <button
                            type="button"
                            onClick={() => copyToClipboard(desc, 'desc')}
                            className="px-3 py-1 bg-slate-700 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors"
                        >
                            {copied === 'desc' ? 'コピーしました' : 'コピー'}
                        </button>
                    </div>
                    <div className="p-4 bg-slate-900/60 border border-slate-700 rounded-xl text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                        {desc || '（説明文なし）'}
                    </div>
                </section>

                {/* リンク */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <a
                        href={data.listing_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-xs font-bold transition-colors"
                    >
                        メルカリ商品ページ
                    </a>
                    <a
                        href={ebaySearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-200 text-xs font-bold transition-colors"
                    >
                        eBay 検索（相場確認）
                    </a>
                </section>

                {/* すべてコピー & eBay出品ページ */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={copyAll}
                        className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition-colors"
                    >
                        {copied === 'all' ? 'コピーしました' : 'タイトル・価格・説明をまとめてコピー'}
                    </button>
                    <a
                        href={EBAY_SELL_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-colors text-center"
                    >
                        eBay の出品ページを開く
                    </a>
                </div>

                <p className="text-[10px] text-slate-500 text-center pt-4">
                    コピーした内容をeBayの出品フォームに貼り付け、写真を追加して出品してください。
                </p>
            </main>
        </div>
    );
}
