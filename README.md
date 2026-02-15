# MyFinance 🏦

プライバシーファーストの個人資産管理システム。

## アーキテクチャ

```
MyFinance/
├── backend/
│   └── gas/                    # Google Apps Script (ETL)
│       ├── appsscript.json     # GAS マニフェスト
│       ├── Config.js           # 設定ファイル（ユーザー編集対象）
│       ├── Utils.js            # ユーティリティ関数
│       ├── EmailParser.js      # メール解析（Ingestion）
│       ├── YahooScraper.js     # Yahoo!ファイナンス スクレイパー（Enrichment）
│       ├── SpreadsheetWriter.js # スプレッドシート書き込み（Storage）
│       └── Main.js             # メイン処理 + Web API
│
└── frontend/                   # Next.js Dashboard
    ├── src/
    │   ├── app/
    │   │   ├── layout.tsx      # ルートレイアウト
    │   │   ├── page.tsx        # ダッシュボードページ (Server Component)
    │   │   ├── DashboardClient.tsx  # ダッシュボードクライアント
    │   │   └── globals.css     # デザインシステム
    │   ├── components/         # UIコンポーネント
    │   │   ├── Header.tsx
    │   │   ├── TotalAssetsCard.tsx
    │   │   ├── AssetAllocationChart.tsx
    │   │   ├── HistoricalTrendChart.tsx
    │   │   ├── ExpenseHeatmap.tsx
    │   │   ├── PortfolioTable.tsx
    │   │   └── TransactionLog.tsx
    │   ├── lib/                # ロジック層
    │   │   ├── dataFetcher.ts
    │   │   ├── formatters.ts
    │   │   └── mockData.ts
    │   └── types/
    │       └── index.ts
    ├── package.json
    └── next.config.mjs
```

## セットアップ

### 1. GAS Backend

1. [Google Apps Script](https://script.google.com/) で新しいプロジェクトを作成
2. `backend/gas/` 内の各ファイルをコピー
3. `Config.js` を編集:
   - `CONFIG.spreadsheet.id` にスプレッドシートIDを設定
   - `CONFIG.notification.adminEmail` にメールアドレスを設定
   - `CONFIG.fundMapping` に保有銘柄を追加
4. `Main.js` の `setupTrigger()` を手動実行してトリガーを設定
5. 「デプロイ」→「ウェブアプリ」でWeb APIをデプロイ

### 2. Frontend Dashboard

```bash
cd frontend
npm install
cp .env.local.example .env.local
# .env.local を編集（GAS_WEB_APP_URL 等）
npm run dev
```

### 3. Gmail フィルタ設定

1. 証券会社からの約定通知メールにフィルタを設定
2. アクション: 「受信トレイをスキップ」「既読にする」「ラベル "資産管理" を付ける」

## 技術スタック

| Layer | Technology |
|-------|-----------|
| **Data Source** | Gmail, Yahoo! Finance |
| **Backend/ETL** | Google Apps Script |
| **Database** | Google Spreadsheet |
| **Frontend** | Next.js 15, TypeScript, Tailwind CSS v4, Recharts |
| **Hosting** | Vercel / Cloudflare Pages |

## 今後のロードマップ

- [x] Phase 1: 投信自動取得・口数計算・DB保存
- [x] Phase 1.5: 銀行入出金メール解析・残高推定
- [ ] Phase 2: クレジットカード決済メール解析
- [x] Phase 3: Next.js ダッシュボード構築
- [ ] Phase 4: LINE Notify アラート連携
