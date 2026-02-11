'use client';

/**
 * MyFinance - Historical Trend Chart
 * 資産推移をエリアチャートで表示。投資額と評価額の推移を重ねて描画。
 */

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import type { AssetHistoryPoint } from '@/types';

interface HistoricalTrendChartProps {
    data: AssetHistoryPoint[];
}

// カスタムツールチップ
function CustomTooltip({
    active,
    payload,
    label,
}: {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}) {
    if (!active || !payload) return null;

    return (
        <div className="custom-tooltip">
            <p className="label">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="text-xs text-[var(--color-text-secondary)]">
                        {p.name === 'totalValue' ? '評価額' : '投資額'}:
                    </span>
                    <span className="value text-sm">{formatCurrency(p.value)}</span>
                </div>
            ))}
            {payload.length === 2 && (
                <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-muted)]">含み益: </span>
                    <span className={`text-sm font-semibold number-display ${payload[0].value - payload[1].value >= 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]'}`}>
                        {formatCurrency(payload[0].value - payload[1].value)}
                    </span>
                </div>
            )}
        </div>
    );
}

// Y軸ティックフォーマッタ
function formatYAxisTick(value: number): string {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 10000) return `${Math.round(value / 10000)}万`;
    return value.toLocaleString();
}

export default function HistoricalTrendChart({ data }: HistoricalTrendChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="card p-6">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">資産推移</h3>
                <p className="text-[var(--color-text-muted)] text-sm">データがありません</p>
            </div>
        );
    }

    return (
        <div className="card p-6">
            {/* ヘッダー */}
            <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-indigo)] bg-opacity-20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-accent-indigo)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                </div>
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">資産推移</h3>
            </div>

            {/* チャート */}
            <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="gradientValue" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradientInvested" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#64748b" stopOpacity={0.15} />
                                <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--color-border)"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            stroke="var(--color-text-muted)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="var(--color-text-muted)"
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={formatYAxisTick}
                            width={50}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="totalValue"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            fill="url(#gradientValue)"
                            dot={false}
                            activeDot={{ r: 5, fill: '#6366f1', stroke: '#1a1f2e', strokeWidth: 2 }}
                            name="totalValue"
                            animationDuration={1200}
                        />
                        <Area
                            type="monotone"
                            dataKey="totalInvested"
                            stroke="#64748b"
                            strokeWidth={1.5}
                            strokeDasharray="4 4"
                            fill="url(#gradientInvested)"
                            dot={false}
                            activeDot={{ r: 4, fill: '#64748b', stroke: '#1a1f2e', strokeWidth: 2 }}
                            name="totalInvested"
                            animationDuration={1200}
                            animationBegin={300}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* カスタム凡例 */}
            <div className="flex items-center gap-6 mt-4 text-xs text-[var(--color-text-muted)]">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-[var(--color-accent-indigo)] rounded-full" />
                    <span>評価額</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 bg-[var(--color-text-muted)] rounded-full" style={{ borderTop: '2px dashed' }} />
                    <span>投資額</span>
                </div>
            </div>
        </div>
    );
}
