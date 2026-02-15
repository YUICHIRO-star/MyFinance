'use client';

/**
 * MyFinance - Balance Adjustment Form
 * 銀行残高の手動補正フォーム。
 * 現在の計算上の残高と実際の残高のズレを修正する。
 */

import { useState } from 'react';
import { formatCurrency } from '@/lib/formatters';

interface BalanceAdjustmentFormProps {
    currentBalance: number;
    lastUpdated: string | null;
}

export default function BalanceAdjustmentForm({
    currentBalance,
    lastUpdated,
}: BalanceAdjustmentFormProps) {
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = Number(amount.replace(/,/g, ''));
        
        if (isNaN(numAmount) || numAmount <= 0) {
            setResult({ success: false, message: '正しい金額を入力してください' });
            return;
        }

        setIsSubmitting(true);
        setResult(null);

        try {
            const res = await fetch('/api/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'adjust_balance',
                    amount: numAmount,
                }),
            });

            const data = await res.json();

            if (data.status === 'ok') {
                setResult({
                    success: true,
                    message: `残高を調整しました（差額: ${formatCurrency(data.adjustment)}）`,
                });
                setAmount('');
            } else {
                setResult({ success: false, message: data.message || 'エラーが発生しました' });
            }
        } catch (error) {
            setResult({ success: false, message: '通信エラーが発生しました' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                </div>
                <div>
                    <h3 className="text-sm font-medium">残高調整</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                        計算残高: {formatCurrency(currentBalance)}
                        {lastUpdated && ` (${lastUpdated})`}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label className="text-xs text-[var(--color-text-muted)] mb-1 block">
                        実際の銀行残高（円）
                    </label>
                    <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="例: 1,500,000"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-indigo)] transition-all"
                        disabled={isSubmitting}
                    />
                </div>

                <button
                    type="submit"
                    disabled={isSubmitting || !amount}
                    className="w-full px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? '送信中...' : '残高を調整'}
                </button>
            </form>

            {result && (
                <div className={`mt-3 p-3 rounded-lg text-xs ${
                    result.success
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                }`}>
                    {result.message}
                </div>
            )}
        </div>
    );
}
