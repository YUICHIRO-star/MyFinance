'use client';

/**
 * MyFinance - Total Assets Card
 * 資産総額・評価損益・前日比を表示するメインカード。
 */

import { formatCurrency, formatPercent, getProfitLossColor, getProfitLossIcon } from '@/lib/formatters';

interface TotalAssetsCardProps {
    totalAssets: number;
    totalInvested: number;
    totalProfitLoss: number;
    totalProfitLossRate: number;
    lastUpdated: string;
}

export default function TotalAssetsCard({
    totalAssets,
    totalInvested,
    totalProfitLoss,
    totalProfitLossRate,
    lastUpdated,
}: TotalAssetsCardProps) {
    const plColor = getProfitLossColor(totalProfitLoss);
    const plIcon = getProfitLossIcon(totalProfitLoss);

    return (
        <div className="card p-6 md:p-8 col-span-full relative overflow-hidden">
            {/* 背景装飾 */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--color-accent-indigo)] opacity-[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[var(--color-accent-violet)] opacity-[0.03] rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
                {/* ヘッダー */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--gradient-primary)] flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">資産総額</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="status-indicator live" />
                                <span className="text-[10px] text-[var(--color-text-muted)]">LIVE</span>
                            </div>
                        </div>
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                        最終更新: {new Date(lastUpdated).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {/* 資産総額 */}
                <div className="mb-6">
                    <p className="text-4xl md:text-5xl font-bold number-display tracking-tight">
                        {formatCurrency(totalAssets)}
                    </p>
                </div>

                {/* サブメトリクス */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-[var(--color-border)]">
                    {/* 累計投資額 */}
                    <div>
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">累計投資額</p>
                        <p className="text-lg font-semibold number-display">{formatCurrency(totalInvested)}</p>
                    </div>

                    {/* 評価損益 */}
                    <div>
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">評価損益</p>
                        <p className={`text-lg font-semibold number-display ${plColor}`}>
                            {plIcon} {formatCurrency(Math.abs(totalProfitLoss))}
                        </p>
                    </div>

                    {/* 損益率 */}
                    <div>
                        <p className="text-xs text-[var(--color-text-muted)] mb-1">トータルリターン</p>
                        <p className={`text-lg font-semibold number-display ${plColor}`}>
                            {formatPercent(totalProfitLossRate)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
