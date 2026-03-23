import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #030712, #0c1a2e)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 'bold', color: '#22d3ee', marginBottom: 20 }}>
          越境EC価格最適化
        </div>
        <div style={{ fontSize: 40, fontWeight: 'bold', marginBottom: 16 }}>
          AIエージェント
        </div>
        <div style={{ fontSize: 28, color: '#94a3b8', marginBottom: 32 }}>
          メルカリ×eBay・Amazon 利益計算AI
        </div>
        <div style={{ display: 'flex', gap: 24, fontSize: 20, color: '#64748b' }}>
          <span>8プラットフォーム対応</span>
          <span>•</span>
          <span>AI英語出品文自動生成</span>
          <span>•</span>
          <span>月額¥4,980</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
