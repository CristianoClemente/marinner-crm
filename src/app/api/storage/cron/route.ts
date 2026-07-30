import { NextResponse } from "next/server";

import { assertCronAuthorized } from "@/lib/cron/auth";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import { runChatMediaGc } from "@/lib/storage/chat-media-gc";

export const runtime = "nodejs";

/**
 * GC de mídia de conversa expirada (retenção 180d).
 * Auth: `x-cron-secret` ou `Authorization: Bearer` (Vercel Cron).
 */
async function handle(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    const result = await runChatMediaGc(supabaseAdmin());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[storage/cron]", err);
    return NextResponse.json(
      { error: "Falha no GC de mídia." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
