import './globals.css';
import ErrorBoundary from './ErrorBoundary';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="ja">
            <body>
                <ErrorBoundary>{children}</ErrorBoundary>
            </body>
        </html>
    );
}
