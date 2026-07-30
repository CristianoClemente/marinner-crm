import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Autoriza crons: `x-cron-secret` (manual/curl) ou
 * `Authorization: Bearer …` (Vercel Cron quando `CRON_SECRET` está setado).
 *
 * Aceita `AUTOMATION_CRON_SECRET` e/ou `CRON_SECRET` (mesmo valor na Vercel).
 * Retorna NextResponse de erro ou `null` se ok.
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const expecteds = [
    process.env.AUTOMATION_CRON_SECRET,
    process.env.CRON_SECRET,
  ].filter((v): v is string => typeof v === "string" && v.length > 0);

  if (expecteds.length === 0) {
    return NextResponse.json(
      { error: "cron não configurado" },
      { status: 503 },
    );
  }

  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const supplied = [headerSecret, bearer].filter((s) => s.length > 0);

  for (const value of supplied) {
    for (const expected of expecteds) {
      if (safeEqual(value, expected)) return null;
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/** Primeiro secret disponível — para reencaminhar pings internos. */
export function cronSecret(): string | null {
  return (
    process.env.AUTOMATION_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}
