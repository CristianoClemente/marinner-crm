import { NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

/** GET /api/billing/plans — catálogo ativo. */
export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const { data, error } = await ctx.supabase
      .from("plans")
      .select(
        "id, code, name, price_cents, currency, interval, max_seats, max_contacts, features, sort_order",
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("[billing/plans]", error.message);
      return NextResponse.json(
        { error: "Não foi possível carregar os planos" },
        { status: 500 },
      );
    }

    return NextResponse.json({ plans: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
