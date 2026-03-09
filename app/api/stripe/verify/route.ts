import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "No session_id" }, { status: 400 });

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" && session.status !== "complete") {
    return NextResponse.json({ error: "Not paid" }, { status: 402 });
  }

  const cookieStore = await cookies();
  cookieStore.set("stripe_premium", "1", {
    httpOnly: true,
    secure: true,
    maxAge: 60 * 60 * 24 * 366,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
