/**
 * MyFinance - Data Fetcher
 * GAS Web API またはモックデータからダッシュボードデータを取得する。
 */

import type {
    TransactionRecord,
    PortfolioItem,
    DashboardData,
    ApiResponse,
    AssetHistoryPoint,
    AllocationSlice,
    HeatmapValue,
} from '@/types';
import { mockDashboardData, FUND_COLORS } from '@/lib/mockData';

const GAS_WEB_APP_URL = process.env.GAS_WEB_APP_URL || '';

/**
 * ダッシュボードの全データを取得する。
 * GAS Web App URL が設定されていない場合はモックデータを返す。
 */
export async function fetchDashboardData(): Promise<DashboardData> {
    if (!GAS_WEB_APP_URL) {
        console.log('[DataFetcher] GAS_WEB_APP_URL が未設定のため、モックデータを使用します');
        return mockDashboardData;
    }

    try {
        // 並列でレコード、ポートフォリオ、銀行残高を取得
        const [recordsRes, portfolioRes, bankRes] = await Promise.all([
            fetch(`${GAS_WEB_APP_URL}?action=records`, { next: { revalidate: 3600 } }),
            fetch(`${GAS_WEB_APP_URL}?action=portfolio`, { next: { revalidate: 3600 } }),
            fetch(`${GAS_WEB_APP_URL}?action=bank`, { next: { revalidate: 0 } }), // 銀行残高は常に最新
        ]);

        if (!recordsRes.ok || !portfolioRes.ok || !bankRes.ok) {
            throw new Error(`API Error: records=${recordsRes.status}, portfolio=${portfolioRes.status}, bank=${bankRes.status}`);
        }

        const recordsData: ApiResponse<TransactionRecord[]> = await recordsRes.json();
        const portfolioData: ApiResponse<PortfolioItem[]> = await portfolioRes.json();
        const bankData: ApiResponse<{ balance: number, lastUpdated: string }> = await bankRes.json();

        if (recordsData.status !== 'ok' || portfolioData.status !== 'ok') {
            throw new Error('API returned error status');
        }

        const records = recordsData.data || [];
        const portfolio = portfolioData.data || [];
        const bankBalance = bankData.data?.balance || 0;
        const bankLastUpdated = bankData.data?.lastUpdated || null;

        // 集計を算出
        const totalInvestmentValue = portfolio.reduce((sum, p) => sum + (p.currentValue || 0), 0);
        const totalInvested = portfolio.reduce((sum, p) => sum + p.totalInvested, 0);
        
        // 総資産 = 投資評価額 + 銀行残高
        const totalAssets = totalInvestmentValue + bankBalance;
        
        const totalProfitLoss = totalInvestmentValue - totalInvested;
        const totalProfitLossRate = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

        return {
            portfolio,
            records,
            totalAssets,
            totalInvested,
            totalProfitLoss, // 投資の損益
            totalProfitLossRate, // 投資の損益率
            assetHistory: buildAssetHistory(records),
            allocation: buildAllocation(portfolio),
            heatmapData: buildHeatmapData(records),
            bankBalance,
            bankLastUpdated,
            lastUpdated: portfolioData.timestamp || new Date().toISOString(),
        };
    } catch (error) {
        console.error('[DataFetcher] Error fetching data:', error);
        // フォールバック: モックデータ
        return mockDashboardData;
    }
}

/** 取引レコードから資産推移データを構築 */
function buildAssetHistory(records: TransactionRecord[]): AssetHistoryPoint[] {
    if (records.length === 0) return [];

    // 月ごとに累計投資額を集計
    const monthlyMap = new Map<string, number>();
    let cumulative = 0;

    const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));

    for (const r of sorted) {
        const month = r.date.substring(0, 7).replace('-', '/');
        cumulative += r.amount;
        monthlyMap.set(month, cumulative);
    }

    return Array.from(monthlyMap.entries()).map(([date, totalInvested]) => ({
        date,
        totalInvested,
        totalValue: Math.round(totalInvested * 1.1), // 概算
    }));
}

/** ポートフォリオ情報から配分データを構築 */
function buildAllocation(portfolio: PortfolioItem[]): AllocationSlice[] {
    const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
    return portfolio
        .filter((p) => p.currentValue && p.currentValue > 0)
        .map((p, i) => ({
            name: p.fundName.length > 20 ? p.fundName.substring(0, 20) + '…' : p.fundName,
            value: p.currentValue!,
            color: FUND_COLORS[p.fundName] || colors[i % colors.length],
        }));
}

/** 取引レコードからヒートマップデータを構築 */
function buildHeatmapData(records: TransactionRecord[]): HeatmapValue[] {
    const dateMap = new Map<string, number>();

    for (const r of records) {
        const isoDate = r.date.replace(/\//g, '-');
        const existing = dateMap.get(isoDate) || 0;
        dateMap.set(isoDate, existing + r.amount);
    }

    return Array.from(dateMap.entries()).map(([date, count]) => ({
        date,
        count,
    }));
}
