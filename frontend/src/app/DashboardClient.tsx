'use client';

/**
 * MyFinance - Dashboard Client Component
 * 全コンポーネントを組み立てるクライアントレイアウト。
 * fade-in アニメーション付きでカードを順番に表示。
 */

import type { DashboardData } from '@/types';
import TotalAssetsCard from '@/components/TotalAssetsCard';
import AssetAllocationChart from '@/components/AssetAllocationChart';
import HistoricalTrendChart from '@/components/HistoricalTrendChart';
import ExpenseHeatmap from '@/components/ExpenseHeatmap';
import PortfolioTable from '@/components/PortfolioTable';
import TransactionLog from '@/components/TransactionLog';

interface DashboardClientProps {
    data: DashboardData;
}

export default function DashboardClient({ data }: DashboardClientProps) {
    return (
        <div className="space-y-6">
            {/* ── Row 1: 資産総額（フルワイド） ── */}
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}>
                <TotalAssetsCard
                    totalAssets={data.totalAssets}
                    totalInvested={data.totalInvested}
                    totalProfitLoss={data.totalProfitLoss}
                    totalProfitLossRate={data.totalProfitLossRate}
                    lastUpdated={data.lastUpdated}
                />
            </div>

            {/* ── Row 2: 推移グラフ + 配分チャート (2:1) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 animate-fade-in-up opacity-0" style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}>
                    <HistoricalTrendChart data={data.assetHistory} />
                </div>
                <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}>
                    <AssetAllocationChart data={data.allocation} totalAssets={data.totalAssets} />
                </div>
            </div>

            {/* ── Row 3: ポートフォリオテーブル（フルワイド） ── */}
            <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}>
                <PortfolioTable data={data.portfolio} />
            </div>

            {/* ── Row 4: ヒートマップ + 取引履歴 (2:1) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 animate-fade-in-up opacity-0" style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}>
                    <ExpenseHeatmap data={data.heatmapData} />
                </div>
                <div className="animate-fade-in-up opacity-0" style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}>
                    <TransactionLog records={data.records} limit={8} />
                </div>
            </div>
        </div>
    );
}
