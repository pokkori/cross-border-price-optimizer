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
      <div className="bg-gray-900 border border-cyan-800 rounded-2xl p-10 max-w-md w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
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
              className="block bg-cyan-500 hover:bg-cyan-400 text-black font-black text-lg py-4 px-8 rounded-xl transition"
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
