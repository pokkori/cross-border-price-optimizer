/** @type {import('next').NextConfig} */
const nextConfig = {
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    // クリックジャッキング防止
                    { key: 'X-Frame-Options', value: 'DENY' },
                    // MIMEスニッフィング防止
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    // リファラー情報の最小化
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    // 不要なブラウザ機能の無効化
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    // HTTPS強制（本番環境向け）
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
