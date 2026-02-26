# 越境EC価格最適化エージェント

メルカリなど国内ECの商品をスクレイピングし、eBay等の海外プラットフォームでの販売利益をAIが自動分析するシステムです。

## クイックスタート (5分)

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example` をコピーして `.env.local` を作成し、最低限 Supabase の接続情報を設定してください。

```bash
cp .env.example .env.local
```

**必須 (ダッシュボード起動に必要):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. データベースのセットアップ

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. Supabase ダッシュボード > SQL Editor を開く
3. `schema.sql` の内容をすべて貼り付けて実行
4. テーブルとシードデータ（サンプル商品・為替レート等）が作成されます

### 4. 起動

```bash
npm run dev
```

ブラウザで http://localhost:3000/dashboard を開いてください。

---

## 機能一覧（実装済み）

以下は**現在利用できる機能**です。説明と実際の動作が一致しています。

| 機能 | 説明 |
|------|------|
| 市場分析 | キーワードでメルカリを検索し、海外販売時の利益を自動試算 |
| AI英語説明文 | Gemini APIで商品説明を英語に最適化（キー未設定時はモック） |
| 利益シミュレータ | SKU・売価を入力してコスト内訳を即座に確認 |
| 通知 | 高利益商品の発見時にLINE/Slackで通知 |
| CSVエクスポート | 分析結果をCSVでダウンロード |
| タグ・メモ | 商品ごとに「有望」「保留」「仕入れ済み」のタグとメモを管理（ブラウザに保存） |

### 未実装（設計・将来拡張）

- 為替レートの自動取得（現状はDBの手動登録のみ）
- Yahoo Auctions のスクレイピング（eBay はおすすめキーワード用に実装済み）
- eBay・StockX への出品・価格更新API連携（ダッシュボードのボタンは「開発中」表示）

詳細は `設計書.md` の「1.3 実装状況サマリ」を参照してください。

## 環境変数

| 変数名 | 必須 | 説明 |
|--------|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | **必須** | Supabase プロジェクトURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **必須** | Supabase anon key (RLS適用) |
| `SCRAPINGBEE_API_KEY` | 分析機能に必要 | [ScrapingBee](https://www.scrapingbee.com/) API Key |
| `GEMINI_API_KEY` | AI説明文に必要 | [Google AI Studio](https://aistudio.google.com/) API Key |
| `LINE_NOTIFY_TOKEN` | 任意 | LINE Notify トークン |
| `SLACK_WEBHOOK_URL` | 任意 | Slack Incoming Webhook URL |
| `MIN_PROFIT_MARGIN_FOR_NOTIFICATION` | 任意 | 通知の最低利益率 (デフォルト: 0.20 = 20%) |
| `NOTIFICATION_MODE` | 任意 | `immediate` (即時) または `summary` (まとめ) |
| `SUMMARY_TOP_N` | 任意 | サマリー通知の上位件数 (デフォルト: 3) |
| `MAX_NOTIFICATIONS_PER_RUN` | 任意 | 1実行あたりの通知上限 |
| `DASHBOARD_BASE_URL` | 任意 | 通知リンク用のダッシュボードURL（未設定時: `http://localhost:3000`） |

## コマンド

```bash
# ダッシュボード (Next.js)
npm run dev

# ワーカー (CLI直接実行)
npm run worker -- 任天堂スイッチ ポケモンカード

# SKU指定で実行
npm run worker -- --sku GADGET-XYZ-001 任天堂スイッチ

# TypeScriptコンパイルチェック
npx tsc --noEmit
```

## プロジェクト構成

```
├── app/                     # Next.js App Router
│   ├── dashboard/page.tsx   # メインダッシュボード
│   └── api/
│       ├── products/        # 商品一覧API
│       ├── analyze/         # 市場分析API
│       ├── simulate/        # 利益シミュレーションAPI
│       └── optimizeListing/ # 出品最適化API
├── main_worker.ts           # メインワークフロー
├── dbService.ts             # Supabase DBアクセス層
├── supabaseClient.ts        # Supabaseクライアント
├── profitCalculator.ts      # 利益計算エンジン
├── priceOptimization.ts     # 価格最適化ロジック
├── mercariScraper.ts        # メルカリスクレイピング
├── geminiService.ts         # Gemini AI連携
├── notifierService.ts       # LINE/Slack通知
├── types.ts                 # 型定義
├── schema.sql               # DBスキーマ + シードデータ
└── .env.example             # 環境変数テンプレート
```

## データベーススキーマ

`schema.sql` に全テーブル定義が含まれています。主要テーブル:

- `products` - 商品マスタ (SKU, 重量, HSコード, 仕入価格)
- `platforms` - プラットフォーム (手数料率)
- `exchange_rates` - 為替レート
- `shipping_zones` / `shipping_rates` - 送料ゾーン・料金
- `customs_duties` - 関税率
- `market_prices` - スクレイピング結果 + 分析データ
- `activity_logs` - ワークフロー実行ログ
- `notification_logs` - 通知履歴

## Cursor エージェントでコマンドが失敗する場合

プロジェクトパスに日本語が含まれると、Cursor のターミナルラッパーがパースエラーを起こします。**`scripts\setup-agent-path.cmd`** を実行すると `C:\dev\ec-agent`（ASCII パス）が作成され、エージェントの `npm install` や `npm run worker` 等は実行可能になります。

**開発サーバー起動**: セットアップ後、`C:\dev\start-ec.cmd` が作成されます。Cursor エージェントはこのランチャーから起動できます（実パスで実行するため Next.js が正常に動作します）。手動で起動する場合は、元のプロジェクトフォルダで `npm run dev` を実行してください。

## 無料で使うには（有料APIを避けたい場合）

「API連携で有料になりたくない」場合は、次のように**無料枠だけ**で運用できます。

| サービス | 無料枠 | 有料になりうるポイント |
|----------|--------|------------------------|
| **Supabase** | 500MB DB・月5万リクエスト等 | 超過時（個人利用ならまず無料のまま） |
| **Vercel** | Hobby 無料 | 商用・大量トラフィック時 |
| **Gemini API** | 無料枠あり（Google AI Studio） | キー未設定ならモック文言で動作し**0円** |
| **ScrapingBee** | 約1,000クレジット/月 | 分析を頻繁に回すと超過→**ここが有料化しやすい** |
| **LINE Notify / Slack** | 無料 | 通知しなければ使わなくてOK |

**完全無料で使うコツ:**

1. **ScrapingBee を設定しない**  
   おすすめキーワードは「参考表示」、分析はモックデータになります。**利益シミュレータ**と**手動で登録した商品・為替**だけで、利益計算・一覧・CSV はすべて無料で使えます。

2. **「利益シミュレータ」を主に使う**  
   仕入価格・想定売価・SKU を入力するだけで、送料・関税・手数料を引いた**純利益**が即出ます。スクレイピングも AI も使わないので **0円** です。

3. **将来オプション: 手動で価格を登録**  
   メルカリ・eBay の価格を自分で入力して保存する機能を足せば、スクレイピングなしで「利益の一覧・比較」まで完全無料で実現できます（実装する場合はその方針で追加可能です）。

まとめ: **Supabase + シミュレータ + 手動マスタ更新** だけで、有料APIに一切頼らず使えます。自動で市場価格を取りたいときだけ ScrapingBee / Gemini を検討してください。

---

## 注意事項

- `NEXT_PUBLIC_` プレフィックスの環境変数はブラウザに露出します。Supabase の anon key は RLS (Row Level Security) で保護してください。
- ScrapingBee APIキーが未設定の場合、モックデータでフォールバックします。ダッシュボードの `data_source` カラムで実データかモックかを区別できます。
- 為替レートや関税率は `exchange_rates` / `customs_duties` テーブルで管理されています。定期的に更新してください。

## 運用のポイント

- **分析の実行**: ダッシュボードからキーワードで分析を開始すると、バックグラウンドでワーカーが動きます。完了まで最大約5分待機し、タイムアウト時は「一覧を更新して結果を確認」してください。
- **ワーカー単体実行**: `npm run worker -- キーワード` で CLI からも実行できます。GitHub Actions で定期実行する場合は、Secrets に Supabase・ScrapingBee・GEMINI・通知用のキーと、本番用の `DASHBOARD_BASE_URL` を設定してください。
- **本番デプロイ（Vercel）**: Next.js を Vercel にデプロイした場合、通知メールやLINE/Slack のリンクを本番URLにするために、Vercel の環境変数で `DASHBOARD_BASE_URL=https://あなたのアプリ.vercel.app` を設定してください。ワーカーを GitHub Actions で動かす場合も、同じ URL を Secrets の `DASHBOARD_BASE_URL` に設定すると通知から正しいダッシュボードに飛べます。

## CI/CD

`.github/workflows/ci.yml` で、push/pull_request 時にビルド・型チェックを実行します。

```bash
# ローカルで型チェック
npx tsc --noEmit
```

## ライセンス

MIT License - 詳細は [LICENSE](LICENSE) を参照してください。
