/**
 * MyFinance - Header Component
 * ダッシュボード上部のヘッダー。
 */

export default function Header() {
    return (
        <header className="glass sticky top-0 z-50 border-b border-[var(--color-border)]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* ロゴ */}
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                            <span className="text-white font-bold text-sm">M</span>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gradient tracking-tight">MyFinance</h1>
                        </div>
                    </div>

                    {/* ナビゲーション */}
                    <nav className="hidden md:flex items-center gap-1">
                        {[
                            { label: 'ダッシュボード', active: true },
                            { label: '取引履歴', active: false },
                            { label: '設定', active: false },
                        ].map((item) => (
                            <button
                                key={item.label}
                                className={`px-4 py-2 rounded-lg text-sm transition-colors ${item.active
                                        ? 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] font-medium'
                                        : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)]'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {/* ステータス */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-bg-card)] border border-[var(--color-border)]">
                            <span className="status-indicator live" />
                            <span className="text-xs text-[var(--color-text-muted)]">Live Data</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
