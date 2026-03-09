import Link from "next/link";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12 text-white">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-cyan-400 text-sm hover:underline mb-8 block">
          ← トップに戻る
        </Link>
        <h1 className="text-2xl font-black mb-8">特定商取引法に基づく表記</h1>
        <table className="w-full text-sm text-gray-300 border-collapse">
          <tbody>
            {[
              ["販売業者", "（販売者名）"],
              ["代表者", "（代表者名）"],
              ["所在地", "（請求があれば遅滞なく開示します）"],
              ["電話番号", "（請求があれば遅滞なく開示します）"],
              ["メールアドレス", "support@example.com"],
              ["販売価格", "¥4,980/月（税込）"],
              ["支払方法", "クレジットカード / Apple Pay / Google Pay"],
              ["支払時期", "毎月自動更新"],
              ["サービス提供", "お支払い完了後、即時にプレミアム機能が有効"],
              ["解約方法", "マイページまたはStripeカスタマーポータルからいつでも解約可能"],
              ["返金", "14日以内にお申し出の場合は返金対応します"],
            ].map(([key, val]) => (
              <tr key={key} className="border-b border-gray-800">
                <td className="py-3 pr-4 font-bold text-gray-400 w-36 align-top">{key}</td>
                <td className="py-3 text-gray-200">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
