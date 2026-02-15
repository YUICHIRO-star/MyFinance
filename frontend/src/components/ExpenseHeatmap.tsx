'use client';

/**
 * MyFinance - Expense Heatmap
 * GitHub Contributions ライクなヒートマップで投資・支出の頻度を可視化。
 */

import CalendarHeatmap from 'react-calendar-heatmap';
import type { HeatmapValue } from '@/types';
import { formatCurrency } from '@/lib/formatters';
import { useState } from 'react';

interface ExpenseHeatmapProps {
    data: HeatmapValue[];
}

function getClassForValue(value: HeatmapValue | null): string {
    if (!value || !value.count) return 'color-empty';
    if (value.count < 2000) return 'color-scale-1';
    if (value.count < 10000) return 'color-scale-2';
    if (value.count < 30000) return 'color-scale-3';
    return 'color-scale-4';
}

export default function ExpenseHeatmap({ data }: ExpenseHeatmapProps) {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; amount: number } | null>(null);

    // 表示範囲（過去1年）
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    return (
        <div className="card p-6 col-span-full relative">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-emerald)] bg-opacity-20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-[var(--color-accent-emerald)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">投資カレンダー</h3>
                </div>

                {/* 凡例 */}
                <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                    <span>少</span>
                    <div className="flex gap-0.5">
                        {['color-empty', 'color-scale-1', 'color-scale-2', 'color-scale-3', 'color-scale-4'].map((cls) => (
                            <div
                                key={cls}
                                className={`w-3 h-3 rounded-sm react-calendar-heatmap`}
                            >
                                <svg width="12" height="12">
                                    <rect width="12" height="12" rx="2" className={cls} />
                                </svg>
                            </div>
                        ))}
                    </div>
                    <span>多</span>
                </div>
            </div>

            {/* ヒートマップ */}
            <div className="overflow-x-auto">
                <div className="min-w-[750px]">
                    <CalendarHeatmap
                        startDate={startDate}
                        endDate={endDate}
                        values={data}
                        classForValue={(value: any) => getClassForValue(value ?? null)}
                        showWeekdayLabels
                        gutterSize={3}
                        onMouseOver={(event: any, value: any) => {
                            if (value && value.count > 0) {
                                const rect = (event.target as HTMLElement).getBoundingClientRect();
                                setTooltip({
                                    x: rect.left + rect.width / 2,
                                    y: rect.top - 8,
                                    date: value.date,
                                    amount: value.count,
                                });
                            }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                    />
                </div>
            </div>

            {/* ツールチップ */}
            {tooltip && (
                <div
                    className="fixed z-50 custom-tooltip text-xs pointer-events-none"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    <p className="label">{tooltip.date}</p>
                    <p className="value">{formatCurrency(tooltip.amount)}</p>
                </div>
            )}
        </div>
    );
}
