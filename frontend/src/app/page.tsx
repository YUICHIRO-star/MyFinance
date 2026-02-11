/**
 * MyFinance - Dashboard Page (Server Component)
 * ダッシュボードのメインページ。
 * Server Component としてデータを取得し、Client Component へ渡す。
 */

import { fetchDashboardData } from '@/lib/dataFetcher';
import Header from '@/components/Header';
import DashboardClient from './DashboardClient';

// ISR: 1時間ごとの再生成
export const revalidate = 3600;

export default async function DashboardPage() {
    const data = await fetchDashboardData();

    return (
        <div className="min-h-screen flex flex-col">
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <DashboardClient data={data} />
            </main>

            {/* フッター */}
            <footer className="border-t border-[var(--color-border)] py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                        <p>© 2025 MyFinance — Privacy First Asset Management</p>
                        <p>
                            Data refreshed via ISR (1h interval)
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
