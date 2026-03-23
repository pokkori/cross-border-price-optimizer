"use client";
import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(false);
    }
  }

  const shareText = encodeURIComponent(
    "AIが仕入れ価格・海外売却価格・利益を自動計算してくれる越境EC価格最適化エージェント。月¥10万副業を目指す人に。 #越境EC #副業 #AI"
  );
  const shareUrl = encodeURIComponent("https://ekkyo-ec-agent.vercel.app");

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="pt-20 pb-16 px-4 text-center">
        <div
          className="inline-block backdrop-blur-sm bg-blue-900/40 border border-blue-500/30 text-blue-300 text-xs font-bold px-3 py-1 rounded-full mb-6"
          aria-label="AI越境EC価格最適化エージェントのサービス紹介"
        >
          AI越境EC価格最適化エージェント
        </div>
        <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
          国内で仕入れ、<span className="text-cyan-400">海外で売る。</span>
          <br />
          AI価格最適化エージェント
        </h1>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto mb-8">
          メルカリ・ヤフオク・楽天市場の最安値を自動検索し、eBay・Amazon・StockXでの売却価格と利益をAIが自動計算。
          <br />
          <strong className="text-white">月¥10万〜の副業収入を実現。</strong>
        </p>
        <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-10" role="list" aria-label="サービス主要指標">
          {[
            ["平均利益率", "23%"],
            ["対応プラットフォーム", "8社"],
            ["1回で分析", "最大50商品"],
          ].map(([label, val]) => (
            <div
              key={label}
              className="backdrop-blur-sm bg-white/5 border border-white/10 shadow-lg rounded-2xl p-4"
              role="listitem"
              aria-label={`${label}: ${val}`}
            >
              <div className="text-cyan-400 text-2xl font-black">{val}</div>
              <div className="text-gray-400 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={startCheckout}
            disabled={loading}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg px-10 py-4 rounded-xl transition disabled:opacity-60 min-h-[44px]"
            aria-label="越境EC価格最適化エージェントを月額4,980円で始める"
          >
            {loading ? "処理中..." : "¥4,980/月で始める →"}
          </button>
          <Link
            href="/dashboard"
            className="border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 font-semibold text-lg px-10 py-4 rounded-xl transition text-center min-h-[44px] flex items-center justify-center"
            aria-label="ダッシュボードのデモ画面を見る"
          >
            デモ画面を見る
          </Link>
        </div>
        <p className="text-gray-500 text-sm mt-4">14日間返金保証 ・ クレジットカード対応</p>
      </section>

      {/* Pain Points */}
      <section className="bg-gray-900 py-16 px-4" aria-labelledby="pain-points-heading">
        <div className="max-w-4xl mx-auto">
          <h2 id="pain-points-heading" className="text-2xl font-bold text-center mb-10">
            越境EC転売で「こんな悩みありませんか？」
          </h2>
          <div className="grid md:grid-cols-3 gap-6" role="list" aria-label="越境EC転売のよくある悩み">
            {[
              {
                svgPath: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
                title: "仕入れ先探しに時間がかかる",
                desc: "メルカリ・ヤフオク・楽天を手動で巡回して価格比較するのに毎日1〜2時間かかっている",
              },
              {
                svgPath: "M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm2.25-4.5h.008v.008H10.5v-.008Zm0 2.25h.008v.008H10.5V13.5Zm0 2.25h.008v.008H10.5v-.008Zm2.25-4.5h.008v.008H12.75v-.008Zm0 2.25h.008v.008H12.75V13.5Zm0 2.25h.008v.008H12.75v-.008ZM6 18.75a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 18.75V7.5A2.25 2.25 0 0 0 15.75 5.25h-7.5A2.25 2.25 0 0 0 6 7.5v11.25Z",
                title: "利益計算が面倒で間違いが多い",
                desc: "送料・関税・手数料を手計算すると漏れが発生し、実際に売ると赤字になることがある",
              },
              {
                svgPath: "M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418",
                title: "英語の出品文が書けない",
                desc: "eBay・Amazonの海外バイヤー向けに魅力的な英語説明文を書くのが難しい",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="backdrop-blur-sm bg-white/5 border border-white/10 shadow-lg rounded-2xl p-6"
                role="listitem"
                aria-label={item.title}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-10 h-10 text-red-400 mb-3"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.svgPath} />
                </svg>
                <h3 className="font-bold text-lg mb-2 text-red-300">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-cyan-400 font-bold text-xl mt-10" aria-live="polite">
            AIエージェントが全部自動化します
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-950 py-16 px-4" aria-labelledby="features-heading">
        <div className="max-w-4xl mx-auto">
          <h2 id="features-heading" className="text-2xl font-bold text-center mb-10">主な機能</h2>
          <div className="grid md:grid-cols-2 gap-6" role="list" aria-label="サービスの主な機能一覧">
            {[
              {
                label: "検索アイコン",
                title: "8プラットフォーム横断価格比較",
                desc: "メルカリ・ヤフオク・楽天・ラクマ・PayPayフリマ（国内）＋ eBay・Amazon・StockX（海外）を一括検索",
                svgPath: "m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z",
              },
              {
                label: "グラフアイコン",
                title: "正確な利益計算",
                desc: "国際送料・関税・各プラットフォーム手数料・為替レートをすべて自動計算。実質利益率をリアルタイム表示",
                svgPath: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z",
              },
              {
                label: "AIアイコン",
                title: "AI英語出品文自動生成",
                desc: "日本語商品名からeBay・Amazon向けの魅力的な英語説明文・タイトルをAIが自動生成",
                svgPath: "M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5",
              },
              {
                label: "雷アイコン",
                title: "即売れ候補を自動抽出",
                desc: "利益率・需要・競合状況を分析し、今すぐ仕入れるべき商品をAIがランキング形式で提示",
                svgPath: "m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z",
              },
              {
                label: "通知アイコン",
                title: "LINE/Slack通知",
                desc: "高利益率の商品が見つかったら即座に通知。チャンスを逃さない",
                svgPath: "M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0",
              },
              {
                label: "ダッシュボードアイコン",
                title: "出品管理ダッシュボード",
                desc: "在庫・タグ付け・メモ管理を一元化。購入済み・検討中・保留をカンタン管理",
                svgPath: "M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="backdrop-blur-sm bg-white/5 border border-white/10 shadow-lg rounded-2xl p-6 flex gap-4"
                role="listitem"
                aria-label={f.title}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-8 h-8 text-cyan-400 shrink-0"
                  aria-hidden="true"
                  aria-label={f.label}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.svgPath} />
                </svg>
                <div>
                  <h3 className="font-bold text-white mb-1">{f.title}</h3>
                  <p className="text-gray-400 text-sm">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-900 py-16 px-4 text-center" aria-labelledby="pricing-heading">
        <div className="max-w-sm mx-auto">
          <h2 id="pricing-heading" className="text-2xl font-bold mb-8">料金</h2>
          <div className="backdrop-blur-sm bg-blue-900/40 border-2 border-cyan-500 shadow-xl shadow-cyan-500/20 rounded-2xl p-8">
            <div className="text-cyan-300 font-bold mb-2">プロプラン</div>
            <div className="text-5xl font-black text-cyan-400 mb-1" aria-label="月額4,980円">¥4,980</div>
            <div className="text-gray-300 text-sm mb-6">/月（税込）</div>
            <ul className="text-gray-200 text-sm space-y-2 text-left mb-6" aria-label="プロプランの含まれる機能">
              <li aria-label="8プラットフォーム横断検索無制限">✓ 8プラットフォーム横断検索（無制限）</li>
              <li aria-label="AI英語出品文生成無制限">✓ AI英語出品文生成（無制限）</li>
              <li aria-label="利益計算・ダッシュボード">✓ 利益計算・ダッシュボード</li>
              <li aria-label="LINE/Slack通知">✓ LINE/Slack通知</li>
              <li aria-label="14日間返金保証">✓ 14日間返金保証</li>
            </ul>
            <button
              onClick={startCheckout}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg py-4 rounded-xl transition disabled:opacity-60 min-h-[44px]"
              aria-label="越境EC価格最適化エージェントのプロプランを今すぐ始める"
            >
              {loading ? "処理中..." : "今すぐ始める →"}
            </button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-gray-950 py-16 px-4" aria-labelledby="testimonials-heading">
        <div className="max-w-4xl mx-auto">
          <h2 id="testimonials-heading" className="text-2xl font-bold text-center mb-10">利用者の声</h2>
          <div className="grid md:grid-cols-3 gap-6" role="list" aria-label="利用者の声一覧">
            {[
              {
                name: "Aさん（副業EC歴2年）",
                text: "手動で価格チェックしていた時間が1/10になりました。月収が¥3万から¥15万に増えました。",
              },
              {
                name: "Bさん（せどり初心者）",
                text: "関税の計算を間違えて赤字になることがなくなりました。AIの利益計算が正確です。",
              },
              {
                name: "Cさん（フリマアプリ出品者）",
                text: "英語の出品文がAIで一瞬で生成されるのが一番助かっています。eBayの売上が3倍になりました。",
              },
            ].map((t) => (
              <div
                key={t.name}
                className="backdrop-blur-sm bg-white/5 border border-white/10 shadow-lg rounded-2xl p-6"
                role="listitem"
                aria-label={`${t.name}の口コミ`}
              >
                <p className="text-gray-200 text-sm mb-4">「{t.text}」</p>
                <p className="text-cyan-400 text-xs font-bold">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Share Section */}
      <section className="bg-gray-900 py-12 px-4 text-center" aria-labelledby="share-heading">
        <div className="max-w-md mx-auto">
          <h2 id="share-heading" className="text-lg font-bold mb-4 text-gray-300">友人・知人にシェアする</h2>
          <a
            href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 backdrop-blur-sm bg-black/60 border border-white/20 hover:bg-black/80 text-white font-bold px-6 py-3 rounded-xl transition min-h-[44px]"
            aria-label="越境EC価格最適化エージェントをXでシェアする"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Xでシェアする
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 text-center text-gray-500 text-xs">
        <p>© 2026 AI越境EC価格最適化エージェント</p>
        <nav className="mt-2 flex flex-wrap justify-center gap-4" aria-label="フッターナビゲーション">
          <Link
            href="/legal"
            className="hover:text-gray-300 underline"
            aria-label="特定商取引法に基づく表記ページへ"
          >
            特定商取引法に基づく表記
          </Link>
          <Link
            href="/privacy"
            className="hover:text-gray-300 underline"
            aria-label="プライバシーポリシーページへ"
          >
            プライバシーポリシー
          </Link>
          <Link
            href="/terms"
            className="hover:text-gray-300 underline"
            aria-label="利用規約ページへ"
          >
            利用規約
          </Link>
        </nav>
      </footer>
    </main>
  );
}
