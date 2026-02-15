/**
 * MyFinance - Mock Data
 * 開発・デモ用のサンプルデータ。
 * API 未接続時にダッシュボードの表示を確認するために使用。
 */

import type {
    TransactionRecord,
    PortfolioItem,
    DashboardData,
    AssetHistoryPoint,
    AllocationSlice,
    HeatmapValue,
} from '@/types';

// ── モック銘柄カラーパレット ──
const FUND_COLORS: Record<string, string> = {
    'eMAXIS Slim 米国株式(S&P500)': '#6366f1',
    'eMAXIS Slim 全世界株式(オール・カントリー)': '#8b5cf6',
    'SBI・V・S&P500インデックス・ファンド': '#3b82f6',
    'その他': '#64748b',
    '現金': '#10b981',
};

// ── 取引レコード ──
const mockRecords: TransactionRecord[] = [
    { date: '2025/01/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 29850, quantity: 11167, ticker: '0331418A' },
    { date: '2025/02/14', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 30120, quantity: 11067, ticker: '0331418A' },
    { date: '2025/03/14', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 28950, quantity: 11514, ticker: '0331418A' },
    { date: '2025/04/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 31200, quantity: 10684, ticker: '0331418A' },
    { date: '2025/05/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 32100, quantity: 10383, ticker: '0331418A' },
    { date: '2025/06/13', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 31800, quantity: 10481, ticker: '0331418A' },
    { date: '2025/07/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 33500, quantity: 9950, ticker: '0331418A' },
    { date: '2025/08/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 32800, quantity: 10163, ticker: '0331418A' },
    { date: '2025/09/12', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 34100, quantity: 9775, ticker: '0331418A' },
    { date: '2025/10/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 35200, quantity: 9466, ticker: '0331418A' },
    { date: '2025/11/14', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 34800, quantity: 9579, ticker: '0331418A' },
    { date: '2025/12/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 36100, quantity: 9232, ticker: '0331418A' },
    { date: '2026/01/15', fundName: 'eMAXIS Slim 米国株式(S&P500)', amount: 33333, unitPrice: 37200, quantity: 8960, ticker: '0331418A' },
    { date: '2025/01/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 23450, quantity: 7108, ticker: '0331418B' },
    { date: '2025/02/14', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 23780, quantity: 7009, ticker: '0331418B' },
    { date: '2025/03/14', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 22900, quantity: 7278, ticker: '0331418B' },
    { date: '2025/04/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 24100, quantity: 6914, ticker: '0331418B' },
    { date: '2025/05/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 24800, quantity: 6721, ticker: '0331418B' },
    { date: '2025/06/13', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 24500, quantity: 6803, ticker: '0331418B' },
    { date: '2025/07/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 25600, quantity: 6510, ticker: '0331418B' },
    { date: '2025/08/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 25200, quantity: 6614, ticker: '0331418B' },
    { date: '2025/09/12', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 26100, quantity: 6386, ticker: '0331418B' },
    { date: '2025/10/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 26800, quantity: 6219, ticker: '0331418B' },
    { date: '2025/11/14', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 26500, quantity: 6289, ticker: '0331418B' },
    { date: '2025/12/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 27300, quantity: 6105, ticker: '0331418B' },
    { date: '2026/01/15', fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)', amount: 16667, unitPrice: 28000, quantity: 5953, ticker: '0331418B' },
];

// ── ポートフォリオサマリー ──
const mockPortfolio: PortfolioItem[] = [
    {
        fundName: 'eMAXIS Slim 米国株式(S&P500)',
        ticker: '0331418A',
        totalInvested: 433329,
        totalQuantity: 132421,
        latestNav: 37200,
        currentValue: 492606,
        profitLoss: 59277,
        profitLossRate: '13.68',
        recordCount: 13,
    },
    {
        fundName: 'eMAXIS Slim 全世界株式(オール・カントリー)',
        ticker: '0331418B',
        totalInvested: 216671,
        totalQuantity: 85809,
        latestNav: 28000,
        currentValue: 240265,
        profitLoss: 23594,
        profitLossRate: '10.89',
        recordCount: 13,
    },
];

// ── 資産推移データ ──
const mockAssetHistory: AssetHistoryPoint[] = [
    { date: '2025/01', totalValue: 50200, totalInvested: 50000 },
    { date: '2025/02', totalValue: 102500, totalInvested: 100000 },
    { date: '2025/03', totalValue: 147800, totalInvested: 150000 },
    { date: '2025/04', totalValue: 209600, totalInvested: 200000 },
    { date: '2025/05', totalValue: 265300, totalInvested: 250000 },
    { date: '2025/06', totalValue: 310200, totalInvested: 300000 },
    { date: '2025/07', totalValue: 371500, totalInvested: 350000 },
    { date: '2025/08', totalValue: 415800, totalInvested: 400000 },
    { date: '2025/09', totalValue: 471200, totalInvested: 450000 },
    { date: '2025/10', totalValue: 533400, totalInvested: 500000 },
    { date: '2025/11', totalValue: 580700, totalInvested: 550000 },
    { date: '2025/12', totalValue: 648900, totalInvested: 600000 },
    { date: '2026/01', totalValue: 732871, totalInvested: 650000 },
];

// ── 資産配分（円グラフ） ──
const mockAllocation: AllocationSlice[] = [
    { name: 'eMAXIS Slim 米国株式(S&P500)', value: 492606, color: '#6366f1' },
    { name: 'eMAXIS Slim 全世界株式(オルカン)', value: 240265, color: '#8b5cf6' },
];

// ── ヒートマップデータ（年間の投資日） ──
function generateMockHeatmap(): HeatmapValue[] {
    const data: HeatmapValue[] = [];
    const start = new Date(2025, 0, 1);
    const end = new Date(2026, 1, 11);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        // 15日前後をピーク（投信の約定日）
        const dayOfMonth = d.getDate();
        let count = 0;
        if (dayOfMonth === 15 || dayOfMonth === 14 || dayOfMonth === 13) {
            count = 50000; // 投信の積立日
        } else if (Math.random() < 0.15) {
            count = Math.floor(Math.random() * 5000) + 500; // ランダムな少額支出
        }
        if (count > 0) {
            data.push({ date: dateStr, count });
        }
    }
    return data;
}

// ── ダッシュボード統合データ ──
export const mockDashboardData: DashboardData = {
    portfolio: mockPortfolio,
    records: mockRecords,
    totalAssets: 732871,
    totalInvested: 650000,
    totalProfitLoss: 82871,
    totalProfitLossRate: 12.75,
    assetHistory: mockAssetHistory,
    allocation: mockAllocation,
    heatmapData: [], // 省略
    bankBalance: 1500000,
    bankLastUpdated: '2025-05-01T10:00:00Z',
    lastUpdated: '2025-05-01T10:00:00Z',
};

export { FUND_COLORS };
