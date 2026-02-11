'use client';

/**
 * MyFinance - Transaction Log
 * 直近の取引履歴を表示するカード。
 */

import type { TransactionRecord } from '@/types';
import { formatCurrency, formatDateShort } from '@/lib/formatters';

interface TransactionLogProps {
    records: TransactionRecord[];
    limit?: number;
}

export default function TransactionLog({ records, limit = 10 }: TransactionLogProps) {
    const sorted = [...records]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);

    return (
        <div className="card p-6">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-cyan)] bg-opacity-20 flex items-center justify-center">
                        <svg className="w-4 h-4 text-[var(--color-accent-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)]">最近の取引</h3>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{records.length}件</span>
            </div>

            {/* 取引リスト */}
            <div className="space-y-1">
                {sorted.map((record, i) => (
                    <div
                        key={i}
                        className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors group"
                    >
                        <div className="flex items-center gap-3">
                            {/* 日付バッジ */}
                            <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-elevated)] group-hover:bg-[var(--color-bg-card)] flex items-center justify-center flex-shrink-0 transition-colors">
                                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                                    {formatDateShort(record.date)}
                                </span>
                            </div>

                            <div>
                                <p className="text-sm font-medium text-[var(--color-text-primary)] leading-tight">
                                    {record.fundName.length > 25 ? record.fundName.substring(0, 25) + '…' : record.fundName}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                                    口数: {(record.quantity / 10000).toFixed(2)}万口 · 基準価額: ¥{record.unitPrice.toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-4">
                            <p className="text-sm font-semibold number-display text-[var(--color-text-primary)]">
                                {formatCurrency(record.amount)}
                            </p>
                            <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">積立</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
