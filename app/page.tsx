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

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="pt-20 pb-16 px-4 text-center">
        <div className="inline-block bg-blue-900 text-blue-300 text-xs font-bold px-3 py-1 rounded-full mb-6">
          🤖 AI越境EC価格最適化エージェント
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
        <div className="grid grid-cols-3 gap-6 max-w-md mx-auto mb-10">
          {[
            ["平均利益率", "23%"],
            ["対応プラットフォーム", "8社"],
            ["1回で分析", "最大50商品"],
          ].map(([label, val]) => (
            <div key={label} className="bg-gray-900 rounded-xl p-4">
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
            className="border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 font-semibold text-lg px-10 py-4 rounded-xl transition text-center"
          >
            デモ画面を見る
          </Link>
        </div>
        <p className="text-gray-500 text-sm mt-4">14日間返金保証 ・ クレジットカード対応</p>
      </section>

      {/* Pain Points */}
      <section className="bg-gray-900 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">
            越境EC転売で「こんな悩みありませんか？」
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: "⏰",
                title: "仕入れ先探しに時間がかかる",
                desc: "メルカリ・ヤフオク・楽天を手動で巡回して価格比較するのに毎日1〜2時間かかっている",
              },
              {
                icon: "🧮",
                title: "利益計算が面倒で間違いが多い",
                desc: "送料・関税・手数料を手計算すると漏れが発生し、実際に売ると赤字になることがある",
              },
              {
                icon: "🌍",
                title: "英語の出品文が書けない",
                desc: "eBay・Amazonの海外バイヤー向けに魅力的な英語説明文を書くのが難しい",
              },
            ].map((item) => (
              <div key={item.title} className="bg-gray-800 rounded-2xl p-6">
                <div className="text-4xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-lg mb-2 text-red-300">{item.title}</h3>
                <p className="text-gray-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-center text-cyan-400 font-bold text-xl mt-10">
            ↓ AIエージェントが全部自動化します ↓
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-950 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">主な機能</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: "🔍",
                title: "8プラットフォーム横断価格比較",
                desc: "メルカリ・ヤフオク・楽天・ラクマ・PayPayフリマ（国内）＋ eBay・Amazon・StockX（海外）を一括検索",
              },
              {
                icon: "📊",
                title: "正確な利益計算",
                desc: "国際送料・関税・各プラットフォーム手数料・為替レートをすべて自動計算。実質利益率をリアルタイム表示",
              },
              {
                icon: "🤖",
                title: "AI英語出品文自動生成",
                desc: "日本語商品名からeBay・Amazon向けの魅力的な英語説明文・タイトルをAIが自動生成",
              },
              {
                icon: "⚡",
                title: "即売れ候補を自動抽出",
                desc: "利益率・需要・競合状況を分析し、今すぐ仕入れるべき商品をAIがランキング形式で提示",
              },
              {
                icon: "📱",
                title: "LINE/Slack通知",
                desc: "高利益率の商品が見つかったら即座に通知。チャンスを逃さない",
              },
              {
                icon: "📋",
                title: "出品管理ダッシュボード",
                desc: "在庫・タグ付け・メモ管理を一元化。購入済み・検討中・保留をカンタン管理",
              },
            ].map((f) => (
              <div key={f.title} className="bg-gray-900 rounded-2xl p-6 flex gap-4">
                <div className="text-3xl shrink-0">{f.icon}</div>
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
      <section className="bg-gray-900 py-16 px-4 text-center">
        <div className="max-w-sm mx-auto">
          <h2 className="text-2xl font-bold mb-8">料金</h2>
          <div className="bg-blue-900 border-2 border-cyan-500 rounded-2xl p-8">
            <div className="text-cyan-300 font-bold mb-2">プロプラン</div>
            <div className="text-5xl font-black text-cyan-400 mb-1">¥4,980</div>
            <div className="text-gray-300 text-sm mb-6">/月（税込）</div>
            <ul className="text-gray-200 text-sm space-y-2 text-left mb-6">
              <li>✓ 8プラットフォーム横断検索（無制限）</li>
              <li>✓ AI英語出品文生成（無制限）</li>
              <li>✓ 利益計算・ダッシュボード</li>
              <li>✓ LINE/Slack通知</li>
              <li>✓ 14日間返金保証</li>
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
      <section className="bg-gray-950 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">利用者の声</h2>
          <div className="grid md:grid-cols-3 gap-6">
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
              <div key={t.name} className="bg-gray-900 rounded-2xl p-6">
                <p className="text-gray-200 text-sm mb-4">「{t.text}」</p>
                <p className="text-cyan-400 text-xs font-bold">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 text-center text-gray-500 text-xs">
        <p>© 2026 AI越境EC価格最適化エージェント</p>
        <p className="mt-2">
          <Link href="/legal" className="hover:text-gray-300 underline">
            特定商取引法に基づく表記
          </Link>
        </p>
      </footer>
    </main>
  );
}
