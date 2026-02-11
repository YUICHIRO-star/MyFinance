/** @type {import('next').NextConfig} */
const nextConfig = {
    // ISR: 1時間ごとの再生成
    experimental: {},

    // 環境変数
    env: {
        GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID || '',
        GAS_WEB_APP_URL: process.env.GAS_WEB_APP_URL || '',
    },

    // 画像の外部ドメイン
    images: {
        domains: [],
    },
};

export default nextConfig;
