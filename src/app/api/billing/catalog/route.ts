import { NextResponse } from "next/server";

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

/** GET /api/billing/catalog — planos ativos (público, para o cadastro). */
export async function GET(request: Request) {
  const limit = checkRateLimit(
    `billing-catalog:${clientIp(request)}`,
    RATE_LIMITS.invitationPeek,
  );
  if (!limit.success) return rateLimitResponse(limit);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("plans")
    .select(
      "id, code, name, price_cents, currency, interval, max_seats, max_contacts, features, sort_order",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar os planos" },
      { status: 500 },
    );
  }

  return NextResponse.json({ plans: data ?? [] });
}
