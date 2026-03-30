export default function Privacy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', fontFamily: 'sans-serif', lineHeight: 1.8, color: '#e2e8f0', background: '#0f172a', minHeight: '100vh' }}>
      <h1>プライバシーポリシー</h1>
      <p>越境EC価格最適化エージェント（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。</p>
      <h2>収集する情報</h2>
      <p>本サービスは、入力されたEC商品情報・価格データを処理します。個人を特定できる情報は収集・保存しません。</p>
      <h2>情報の利用目的</h2>
      <p>入力データはAI分析のみに使用し、第三者へ提供しません。分析後のデータは保存しません。</p>
      <h2>Cookieについて</h2>
      <p>本サービスでは、利用状況の把握のためにCookieおよびローカルストレージを使用する場合があります。</p>
      <h2>外部送信規律に基づく情報送信</h2>
      <p>本サービスでは、電気通信事業法の外部送信規律に基づき、以下の外部サービスにデータを送信しています。</p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em', marginTop: '8px' }}>
        <thead><tr style={{ borderBottom: '1px solid #334155' }}><th style={{ textAlign: 'left', padding: '8px 8px 8px 0' }}>送信先</th><th style={{ textAlign: 'left', padding: '8px 8px 8px 0' }}>目的</th><th style={{ textAlign: 'left', padding: '8px 0' }}>送信される情報</th></tr></thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #1e293b' }}><td style={{ padding: '8px 8px 8px 0' }}>Anthropic（Claude API）</td><td style={{ padding: '8px 8px 8px 0' }}>AIによる価格最適化分析</td><td style={{ padding: '8px 0' }}>ユーザーの入力データ（商品情報・価格データ）</td></tr>
          <tr><td style={{ padding: '8px 8px 8px 0' }}>Vercel Inc.</td><td style={{ padding: '8px 8px 8px 0' }}>ホスティング・アクセス解析</td><td style={{ padding: '8px 0' }}>ページビュー・デバイス情報</td></tr>
        </tbody>
      </table>
      <h2>お問い合わせ</h2>
      <p>X: <a href="https://twitter.com/levona_design" style={{ color: '#6366f1' }}>@levona_design</a></p>
      <p style={{ marginTop: '24px' }}><a href="/" style={{ color: '#6366f1' }}>トップに戻る</a></p>
    </div>
  );
}
