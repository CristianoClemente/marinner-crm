import { NextResponse } from "next/server";

import { assertCronAuthorized, cronSecret } from "@/lib/cron/auth";

export const runtime = "nodejs";

/**
 * Um único cron diário (compatível com Vercel Hobby: 1 job/dia).
 * Encaminha para automations, flows e storage com o mesmo secret.
 */
async function handle(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const secret = cronSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "cron não configurado" },
      { status: 503 },
    );
  }

  const origin = new URL(request.url).origin;
  const headers = {
    "x-cron-secret": secret,
    Authorization: `Bearer ${secret}`,
  };

  const paths = [
    "/api/automations/cron",
    "/api/flows/cron",
    "/api/storage/cron",
  ] as const;

  const results: Record<string, unknown> = {};
  for (const path of paths) {
    try {
      const res = await fetch(`${origin}${path}`, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      const body = await res.json().catch(() => null);
      results[path] = { status: res.status, body };
    } catch (err) {
      console.error("[cron/daily] falha em", path, err);
      results[path] = {
        status: 500,
        error: err instanceof Error ? err.message : "fetch failed",
      };
    }
  }

  return NextResponse.json({ ok: true, results });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
