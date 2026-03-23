export default function Terms() {
  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "sans-serif",
        lineHeight: 1.8,
        color: "#e2e8f0",
        background: "#030712",
        minHeight: "100vh",
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "24px" }}>利用規約</h1>
      <p>
        越境EC価格最適化エージェント（以下「本サービス」）をご利用いただくにあたり、以下の利用規約に同意いただく必要があります。
      </p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginTop: "32px", marginBottom: "12px", color: "#06b6d4" }}>
        サービスの利用
      </h2>
      <p>
        本サービスは、越境EC取引の価格最適化を支援するAIエージェントです。提供される価格情報・利益予測は参考値であり、投資判断の根拠にしないでください。
      </p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginTop: "32px", marginBottom: "12px", color: "#06b6d4" }}>
        禁止事項
      </h2>
      <ul style={{ paddingLeft: "24px" }}>
        <li>違法な商品の取引への利用</li>
        <li>本サービスのリバースエンジニアリング</li>
        <li>APIの不正利用・大量アクセス</li>
      </ul>

      <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginTop: "32px", marginBottom: "12px", color: "#06b6d4" }}>
        免責事項
      </h2>
      <p>
        AIによる価格分析・利益予測の精度は保証しません。実際の取引損益について当社は一切の責任を負いません。
      </p>

      <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", marginTop: "32px", marginBottom: "12px", color: "#06b6d4" }}>
        特定商取引法に基づく表記
      </h2>
      <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "16px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "8px", border: "1px solid #334155", fontWeight: "bold", whiteSpace: "nowrap" }}>販売事業者</td>
            <td style={{ padding: "8px", border: "1px solid #334155" }}>ポッコリラボ</td>
          </tr>
          <tr>
            <td style={{ padding: "8px", border: "1px solid #334155", fontWeight: "bold", whiteSpace: "nowrap" }}>所在地</td>
            <td style={{ padding: "8px", border: "1px solid #334155" }}>お問い合わせ後に開示します</td>
          </tr>
          <tr>
            <td style={{ padding: "8px", border: "1px solid #334155", fontWeight: "bold", whiteSpace: "nowrap" }}>連絡先</td>
            <td style={{ padding: "8px", border: "1px solid #334155" }}>X: @levona_design</td>
          </tr>
          <tr>
            <td style={{ padding: "8px", border: "1px solid #334155", fontWeight: "bold", whiteSpace: "nowrap" }}>料金</td>
            <td style={{ padding: "8px", border: "1px solid #334155" }}>月額¥4,980（14日間返金保証）</td>
          </tr>
          <tr>
            <td style={{ padding: "8px", border: "1px solid #334155", fontWeight: "bold", whiteSpace: "nowrap" }}>支払方法</td>
            <td style={{ padding: "8px", border: "1px solid #334155" }}>クレジットカード（Stripe経由）</td>
          </tr>
          <tr>
            <td style={{ padding: "8px", border: "1px solid #334155", fontWeight: "bold", whiteSpace: "nowrap" }}>返金ポリシー</td>
            <td style={{ padding: "8px", border: "1px solid #334155" }}>購入後14日以内にお問い合わせください</td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: "40px" }}>
        <a href="/" style={{ color: "#06b6d4" }} aria-label="トップページに戻る">
          トップに戻る
        </a>
      </p>
    </div>
  );
}
