# 検証記録

2026-09-20、ローカル検証環境。架空データのみ使用。

## 結果

- `npm test`: 25件成功。金融集計、返金／振替、速報置換、CSV整合性、JST、欠損評価額、認証、Origin照合、GASのフィクスチャ、暗号化・改ざん検出。
- `npm run build`: Next.js 15.5.25の本番ビルド成功。TypeScriptとLintもビルド時に検証。
- `npm run test:http`: 本番サーバーをローカル起動し、匿名アクセス拒否、Middleware迂回ヘッダーへの拒否、認証後HTMLに秘密情報なし、不正接続先拒否、旧書込経路拒否、別Origin拒否、AI未設定時の拒否を確認。
- Chromium実操作: 1440pxのデスクトップと390pxのモバイル。画面切替、検索、速報フィルター、保有銘柄表示、暗号化保存→再読込→復号、金額マスク、CSV取込時のデモ除去、ページ全体の横はみ出しなし、JavaScript例外・Hydrationエラーなし。
- 日本語の表示をスクリーンショットで確認。フォントは自ホストし、外部フォントサービスに通信しない。
- `npm audit`: 実施時点で検出0件。将来の脆弱性や独自コードの安全性を保証するものではない。

## UI検証の再実行

本番ビルド後、PlaywrightとChromiumを用意した開発環境で `node tests/browser-smoke.mjs` を実行。必要に応じて `PLAYWRIGHT_MODULE` にPlaywrightのESMエントリーファイル、`CHROMIUM_EXECUTABLE_PATH` に実行ファイルを指定する。ポート3089を使用し、アプリ接続用環境変数は子プロセスで空にする。架空デモだけを操作し、実口座へ接続しない。

結果画像: [デスクトップ](screenshots/desktop.png)、[モバイル](screenshots/mobile.png)、[分析](screenshots/insights.png)。

## 未検証・未実装

- 実銀行・証券・カードAPIの認可、接続、提供頻度、認証更新。
- 実Gmail／GAS／Google Sheetsへのデプロイと本番データ移行。GASテストはVMと使い捨てフィクスチャのみ。
- Ollamaの実モデルによる生成品質・性能。未設定／拒否経路のみ検証。
- 実機iPhone Safari、VoiceOver、外部セキュリティ監査、長時間負荷試験。
- 全金融機関のリアルタイム同期、Push通知、複数ユーザー、本番運用。
- AV JAPAN radarとの接続。別会話の構想を設計メモへ反映した段階。

本番接続やデプロイを行った記録ではない。GitHub Actionsの実行結果はGitHub上で別途確認する。
