"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function SuccessContent() {
  const params = useSearchParams();
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) return;
    fetch(`/api/stripe/verify?session_id=${sessionId}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) setVerified(true); });
  }, [params]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 text-white">
      <div className="backdrop-blur-sm bg-white/5 border border-white/10 shadow-xl rounded-2xl p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 bg-cyan-500/20 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-black mb-4 text-cyan-400">
          {verified ? "サブスクリプション開始！" : "確認中..."}
        </h1>
        {verified ? (
          <>
            <p className="text-gray-300 mb-6 text-sm">
              プロプランが有効になりました。
              ダッシュボードで価格最適化を始めましょう！
            </p>
            <Link
              href="/dashboard"
              className="block bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg py-4 px-8 rounded-xl transition min-h-[44px] flex items-center justify-center"
              aria-label="ダッシュボードを開いて価格最適化を始める"
            >
              ダッシュボードを開く →
            </Link>
          </>
        ) : (
          <p className="text-gray-400 text-sm">お支払いを確認しています...</p>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
