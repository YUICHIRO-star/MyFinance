'use client';

/**
 * MyFinance - Asset Allocation Pie Chart
 * 資産配分を円グラフで可視化。
 */

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/formatters';
import type { AllocationSlice } from '@/types';

interface AssetAllocationChartProps {
    data: AllocationSlice[];
    totalAssets: number;
}

// カスタムツールチップ
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: AllocationSlice }> }) {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0];
    return (
        <div className="custom-tooltip">
            <p className="label">{item.name}</p>
            <p className="value">{formatCurrency(item.value)}</p>
        </div>
    );
}

// カスタムラベル
function renderCustomLabel({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
}: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
}) {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    if (percent < 0.05) return null;

    return (
        <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600}>
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
}

export default function AssetAllocationChart({ data, totalAssets }: AssetAllocationChartProps) {
    if (!data || data.length === 0) {
        return (
            <div className="card p-6">
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-4">資産配分</h3>
                <p className="text-[var(--color-text-muted)] text-sm">データがありません</p>
            </div>
        );
    }

    return (
        <div className="card p-6">
            {/* ヘッダー */}
            <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-violet)] bg-opacity-20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-[var(--color-accent-violet)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                </div>
                <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">資産配分</h3>
            </div>

            {/* チャート */}
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="value"
                            labelLine={false}
                            label={renderCustomLabel}
                            animationBegin={200}
                            animationDuration={800}
                        >
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.color}
                                    stroke="transparent"
                                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                                />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            {/* 凡例 */}
            <div className="mt-4 space-y-2">
                {data.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-[var(--color-text-secondary)] truncate max-w-[180px]">{item.name}</span>
                        </div>
                        <span className="number-display text-[var(--color-text-primary)] font-medium">
                            {formatCurrency(item.value)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
