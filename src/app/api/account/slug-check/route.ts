// GET /api/account/slug-check?slug=
// Public availability check for signup (rate-limited per IP).

import { NextResponse } from "next/server";

import { validateSlug } from "@/lib/account/slug";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: Request) {
  const ip = clientIp(request);
  const limit = checkRateLimit(
    `slug-check:${ip}`,
    RATE_LIMITS.invitationPeek,
  );
  if (!limit.success) return rateLimitResponse(limit);

  const url = new URL(request.url);
  const raw = url.searchParams.get("slug") ?? "";
  const result = validateSlug(raw);

  if (!result.ok) {
    return NextResponse.json({
      available: false,
      slug: result.slug,
      reason: result.error ?? "invalid_format",
    });
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("accounts")
    .select("id")
    .eq("slug", result.slug)
    .maybeSingle();

  if (error) {
    console.error("[slug-check] lookup failed:", error.message);
    return NextResponse.json(
      { error: "Não foi possível verificar o slug" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    available: !data,
    slug: result.slug,
    reason: data ? "taken" : null,
  });
}
