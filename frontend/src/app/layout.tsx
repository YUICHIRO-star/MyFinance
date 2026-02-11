import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'MyFinance - 個人資産管理ダッシュボード',
    description: 'プライバシーファーストの個人資産管理システム。投資信託の自動取得・口数計算・評価額トラッキング。',
    keywords: ['資産管理', '投資信託', 'ポートフォリオ', 'ダッシュボード'],
    openGraph: {
        title: 'MyFinance Dashboard',
        description: 'Privacy-first personal finance management system',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ja" className="dark">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Noto+Sans+JP:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="min-h-screen bg-[var(--color-bg-primary)] antialiased">
                {children}
            </body>
        </html>
    );
}
