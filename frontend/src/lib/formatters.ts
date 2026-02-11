/**
 * MyFinance - 数値フォーマットユーティリティ
 */

/**
 * 金額を日本円フォーマットで表示する。
 * @example formatCurrency(1234567) → "¥1,234,567"
 */
export function formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    return `¥${value.toLocaleString('ja-JP')}`;
}

/**
 * パーセンテージ表示。
 * @example formatPercent(12.75) → "+12.75%"
 */
export function formatPercent(value: number | string | null | undefined): string {
    if (value === null || value === undefined) return '—';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '—';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
}

/**
 * 口数表示（万口単位）。
 * @example formatQuantity(132421) → "13.24万口"
 */
export function formatQuantity(value: number): string {
    return `${(value / 10000).toFixed(2)}万口`;
}

/**
 * 日付を短縮フォーマットで表示。
 * @example formatDateShort("2025/01/15") → "1/15"
 */
export function formatDateShort(dateStr: string): string {
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length >= 3) {
        return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
    }
    return dateStr;
}

/**
 * 損益に応じた色クラス名を返す。
 */
export function getProfitLossColor(value: number | null | undefined): string {
    if (value === null || value === undefined || value === 0) return 'text-[var(--color-neutral)]';
    return value > 0 ? 'text-[var(--color-profit)]' : 'text-[var(--color-loss)]';
}

/**
 * 損益に応じたアイコン（△/▽）を返す。
 */
export function getProfitLossIcon(value: number | null | undefined): string {
    if (value === null || value === undefined || value === 0) return '—';
    return value > 0 ? '△' : '▽';
}
