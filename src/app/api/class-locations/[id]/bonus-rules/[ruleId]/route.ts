import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { validateBonusRulePatch } from "@/lib/class-locations/validate";

type RouteCtx = { params: Promise<{ id: string; ruleId: string }> };

export async function PATCH(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id, ruleId } = await params;
    const body = await request.json().catch(() => null);
    const parsed = validateBonusRulePatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("class_location_bonus_rules")
      .update(parsed.value)
      .eq("account_id", ctx.accountId)
      .eq("location_id", id)
      .eq("id", ruleId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/class-locations/id/bonus-rules/ruleId]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Regra não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ rule: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id, ruleId } = await params;

    const { data, error } = await ctx.supabase
      .from("class_location_bonus_rules")
      .update({ active: false })
      .eq("account_id", ctx.accountId)
      .eq("location_id", id)
      .eq("id", ruleId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error(
        "[DELETE /api/class-locations/id/bonus-rules/ruleId]",
        error,
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Regra não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ rule: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
