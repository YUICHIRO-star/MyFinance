'use client';

/**
 * MyFinance - Portfolio Table
 * 銘柄ごとの保有状況テーブル。
 */

import type { PortfolioItem } from '@/types';
import {
    formatCurrency,
    formatPercent,
    formatQuantity,
    getProfitLossColor,
    getProfitLossIcon,
} from '@/lib/formatters';

interface PortfolioTableProps {
    data: PortfolioItem[];
}

export default function PortfolioTable({ data }: PortfolioTableProps) {
    if (!data || data.length === 0) {
        return (
            <div className="card p-6 col-span-full">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">ポートフォリオ</h3>
                <p className="text-[var(--color-text-muted)] text-sm">データがありません</p>
            </div>
        );
    }

    return (
        <div className="card p-6 col-span-full">
            {/* ヘッダー */}
            <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-blue)] bg-opacity-20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                </div>
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">ポートフォリオ詳細</h3>
            </div>

            {/* テーブル */}
            <div className="overflow-x-auto -mx-6">
                <div className="min-w-[700px] px-6">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>銘柄名</th>
                                <th className="text-right">投資額</th>
                                <th className="text-right">保有口数</th>
                                <th className="text-right">基準価額</th>
                                <th className="text-right">評価額</th>
                                <th className="text-right">損益</th>
                                <th className="text-right">損益率</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, idx) => {
                                const plColor = getProfitLossColor(item.profitLoss);
                                const plIcon = getProfitLossIcon(item.profitLoss);

                                return (
                                    <tr key={idx}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-2 h-8 rounded-full flex-shrink-0"
                                                    style={{
                                                        background: ['#6366f1', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981'][idx % 5],
                                                    }}
                                                />
                                                <div>
                                                    <p className="font-medium text-[var(--color-text-primary)] text-sm leading-tight">
                                                        {item.fundName.length > 30 ? item.fundName.substring(0, 30) + '…' : item.fundName}
                                                    </p>
                                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                                        {item.ticker} · {item.recordCount}回取引
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-right number-display">{formatCurrency(item.totalInvested)}</td>
                                        <td className="text-right number-display text-[var(--color-text-secondary)]">
                                            {formatQuantity(item.totalQuantity)}
                                        </td>
                                        <td className="text-right number-display text-[var(--color-text-secondary)]">
                                            {item.latestNav ? `¥${item.latestNav.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="text-right number-display font-medium">
                                            {formatCurrency(item.currentValue)}
                                        </td>
                                        <td className={`text-right number-display font-medium ${plColor}`}>
                                            {plIcon} {formatCurrency(item.profitLoss ? Math.abs(item.profitLoss) : null)}
                                        </td>
                                        <td className={`text-right number-display font-semibold ${plColor}`}>
                                            {formatPercent(item.profitLossRate)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
