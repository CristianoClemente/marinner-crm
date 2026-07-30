import { NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import {
  resolveBonusRule,
  type BonusRuleCandidate,
} from "@/lib/class-locations/resolve-bonus";
import type { LocationCostType } from "@/lib/class-locations/validate";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;
    const url = new URL(request.url);
    const onParam = url.searchParams.get("on");
    const on =
      onParam && /^\d{4}-\d{2}-\d{2}$/.test(onParam)
        ? onParam
        : new Date().toISOString().slice(0, 10);

    const { data: location, error: locErr } = await supabase
      .from("class_locations")
      .select("id")
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();

    if (locErr) {
      console.error("[GET /api/class-locations/id/bonus/resolve] loc", locErr);
      return NextResponse.json({ error: locErr.message }, { status: 500 });
    }
    if (!location) {
      return NextResponse.json(
        { error: "Local não encontrado" },
        { status: 404 },
      );
    }

    const { data, error } = await supabase
      .from("class_location_bonus_rules")
      .select(
        "id, bonus_type, bonus_amount, starts_on, ends_on, active, created_at",
      )
      .eq("account_id", accountId)
      .eq("location_id", id);

    if (error) {
      console.error("[GET /api/class-locations/id/bonus/resolve]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const candidates: BonusRuleCandidate[] = (data ?? []).map((r) => ({
      id: r.id,
      bonus_type: r.bonus_type as LocationCostType,
      bonus_amount: Number(r.bonus_amount),
      starts_on: r.starts_on,
      ends_on: r.ends_on,
      active: r.active,
      created_at: r.created_at,
    }));

    const bonus = resolveBonusRule(candidates, on);
    return NextResponse.json({ on, bonus });
  } catch (err) {
    return toErrorResponse(err);
  }
}
