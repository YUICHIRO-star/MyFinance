/**
 * MyFinance - Type Definitions
 */

/** 取引レコード（スプレッドシートの1行に対応） */
export interface TransactionRecord {
    date: string;       // YYYY/MM/DD
    fundName: string;   // 銘柄名
    amount: number;     // 投資金額（円）
    unitPrice: number;  // 約定時の基準価額
    quantity: number;   // 取得口数
    ticker: string;     // Yahoo! Finance Code
}

/** ポートフォリオサマリー（銘柄ごとの集計） */
export interface PortfolioItem {
    fundName: string;
    ticker: string;
    totalInvested: number;     // 累計投資額（円）
    totalQuantity: number;     // 累計口数
    latestNav: number | null;  // 最新基準価額
    currentValue: number | null;  // 現在の評価額
    profitLoss: number | null;    // 評価損益
    profitLossRate: string | null; // 損益率（%）
    recordCount: number;       // 取引回数
}

/** GAS Web API のレスポンス */
export interface ApiResponse<T> {
    status: 'ok' | 'error';
    data?: T;
    message?: string;
    timestamp: string;
}

/** 資産推移データ（チャート用） */
export interface AssetHistoryPoint {
    date: string;
    totalValue: number;
    totalInvested: number;
}

/** 円グラフ用データ */
export interface AllocationSlice {
    name: string;
    value: number;
    color: string;
}

/** ヒートマップ用データ */
export interface HeatmapValue {
    date: string;
    count: number; // 支出強度（金額のスケーリング）
}

/** ダッシュボード全体のデータ */
export interface DashboardData {
    portfolio: PortfolioItem[];
    records: TransactionRecord[];
    totalAssets: number;
    totalInvested: number;
    totalProfitLoss: number;
    totalProfitLossRate: number;
    assetHistory: AssetHistoryPoint[];
    allocation: AllocationSlice[];
    heatmapData: HeatmapValue[];
    lastUpdated: string;
}
