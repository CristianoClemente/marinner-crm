import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/flows/admin-client";
import { runChatMediaGc } from "@/lib/storage/chat-media-gc";

export const runtime = "nodejs";

/**
 * GC de mídia de conversa expirada (retenção 180d).
 * Auth: header `x-cron-secret` = AUTOMATION_CRON_SECRET.
 */
async function handle(request: Request) {
  const expected = process.env.AUTOMATION_CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "cron não configurado" },
      { status: 503 },
    );
  }
  const supplied = request.headers.get("x-cron-secret") ?? "";
  if (supplied !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
