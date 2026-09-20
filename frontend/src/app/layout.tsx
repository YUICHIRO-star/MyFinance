import type { Metadata } from "next";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/600.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "MyFinance — お金の流れを、ひとつに。",
  description: "残高・投資・支出と、その根拠を見渡す個人金融ダッシュボード。",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
