import { NextRequest, NextResponse } from 'next/server';

/**
 * ダッシュボード全体をHTTP Basic認証で保護するミドルウェア。
 * DASHBOARD_PASSWORD 環境変数が設定されている場合のみ認証を要求する。
 * 未設定時はローカル開発環境向けにスルーする。
 *
 * 認証情報: ユーザー名は任意（空でも可）、パスワードは DASHBOARD_PASSWORD の値。
 */
export function middleware(request: NextRequest) {
    const password = process.env.DASHBOARD_PASSWORD;

    // パスワード未設定 = 開発環境 → 認証スキップ
    if (!password) {
        return NextResponse.next();
    }

    const authHeader = request.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Basic ')) {
        try {
            const base64 = authHeader.slice(6);
            const decoded = Buffer.from(base64, 'base64').toString('utf-8');
            // "username:password" の形式。パスワード部分のみ検証する
            const colonIndex = decoded.indexOf(':');
            const pass = colonIndex >= 0 ? decoded.slice(colonIndex + 1) : decoded;

            if (pass === password) {
                return NextResponse.next();
            }
        } catch {
            // デコード失敗は不正リクエストとして扱う
        }
    }

    return new NextResponse('認証が必要です', {
        status: 401,
        headers: {
            'WWW-Authenticate': 'Basic realm="Cross-Border Price Optimizer"',
        },
    });
}

export const config = {
    // 静的ファイル・Next.js内部ルートは除外、それ以外全て保護
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
