/**
 * ============================================================
 * MyFinance - Configuration
 * ============================================================
 * 全体設定を管理するモジュール。
 * ユーザーはこのファイルのみを編集すればシステムが動作する。
 * ============================================================
 */

const CONFIG = {
  // ── Gmail ──────────────────────────────────────────────
  gmail: {
    /** 投資信託の約定通知メール検索クエリ（汎用） */
    searchQuery: 'subject:約定 newer_than:1d is:unread',
    /** 一度に処理するスレッド数の上限 */
    maxThreads: 20,
  },

  // ── Google Spreadsheet ─────────────────────────────────
  spreadsheet: {
    /** スプレッドシートID（URLの /d/ と /edit の間の部分） */
    id: '',  // ユーザーが設定
    /** シート名 */
    sheetName: '投信ログ',
  },

  // ── 投資信託の銘柄マッピング ───────────────────────────
  // メール本文内のキーワード → Yahoo! Finance ティッカーコード
  fundMapping: {
    'eMAXIS Slim 米国株式':          { ticker: '0331418A', displayName: 'eMAXIS Slim 米国株式(S&P500)' },
    'eMAXIS Slim 全世界株式':        { ticker: '0331418B', displayName: 'eMAXIS Slim 全世界株式(オール・カントリー)' },
    'eMAXIS Slim 先進国株式':        { ticker: '0331418C', displayName: 'eMAXIS Slim 先進国株式インデックス' },
    'eMAXIS Slim 国内株式':          { ticker: '03311187', displayName: 'eMAXIS Slim 国内株式(TOPIX)' },
    'eMAXIS Slim バランス':          { ticker: '0331418D', displayName: 'eMAXIS Slim バランス(8資産均等型)' },
    'ニッセイ外国株式':               { ticker: '29313164', displayName: '<購入・換金手数料なし>ニッセイ外国株式インデックスファンド' },
    'SBI・V・S&P500':               { ticker: '89311199', displayName: 'SBI・V・S&P500インデックス・ファンド' },
    'SBI・V・全世界株式':             { ticker: '89311209', displayName: 'SBI・V・全世界株式インデックス・ファンド' },
    '楽天・全米株式':                 { ticker: '9I312179', displayName: '楽天・全米株式インデックス・ファンド' },
    '楽天・全世界株式':               { ticker: '9I312189', displayName: '楽天・全世界株式インデックス・ファンド' },
  },

  // ── エラー通知 ─────────────────────────────────────────
  notification: {
    /** エラー通知先メールアドレス */
    adminEmail: '',  // ユーザーが設定
    /** 通知メールの件名プレフィックス */
    subjectPrefix: '[MyFinance Alert]',
  },

  // ── 銀行連携設定 ───────────────────────────────────────
  bank: {
    /** 三井住友銀行 入出金通知メール（ラベル不要・自動検出） */
    searchQuery: 'from:smbc.co.jp subject:三井住友銀行 newer_than:1d is:unread',
    /** シート名 */
    sheetName: '銀行ログ',
    /** 初期残高（スプレッドシート作成時に使用） */
    initialBalance: 0,
  },

  // ── 証券会社連携設定（ラベル不要・自動検出） ─────────────
  brokers: {
    rakuten: {
      /** 楽天証券 約定通知メール（from: tradesys@rakuten-sec.co.jp） */
      searchQuery: 'from:rakuten-sec.co.jp subject:約定 newer_than:1d is:unread',
      domain: 'rakuten-sec.co.jp',
    },
    sbi: {
      /** SBI証券 約定通知メール（from: alert@sbisec.co.jp） */
      searchQuery: 'from:sbisec.co.jp subject:約定 newer_than:1d is:unread',
      domain: 'sbisec.co.jp',
    },
  },

  // ── クレジットカード連携設定（ラベル不要・自動検出） ────────
  creditCards: {
    rakuten: {
      /** 楽天カード利用通知メール（from: *@rakuten-card.co.jp） */
      searchQuery: 'from:rakuten-card.co.jp subject:カード利用 newer_than:1d is:unread',
      domain: 'rakuten-card.co.jp',
    },
  },

  // ── 支出ログ設定 ────────────────────────────────────────
  expense: {
    /** スプレッドシートのシート名 */
    sheetName: '支出ログ',
  },

  // ── Yahoo! Finance スクレイピング ──────────────────────
  yahoo: {
    /** 時系列ページの基底URL */
    baseUrl: 'https://finance.yahoo.co.jp/quote/',
    /** HistoryページのURL末尾 */
    historySuffix: '/history',
    /** リクエスト間隔（ms） - サーバーに負荷をかけないため */
    requestDelay: 2000,
    /** User-Agent */
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};
