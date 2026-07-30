import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { validateBonusRuleCreate } from "@/lib/class-locations/validate";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;

    const { data: location, error: locErr } = await supabase
      .from("class_locations")
      .select("id")
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();

    if (locErr) {
      console.error("[GET /api/class-locations/id/bonus-rules] loc", locErr);
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
      .select("*")
      .eq("account_id", accountId)
      .eq("location_id", id)
      .order("starts_on", { ascending: false });

    if (error) {
      console.error("[GET /api/class-locations/id/bonus-rules]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rules: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = validateBonusRuleCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: location, error: locErr } = await ctx.supabase
      .from("class_locations")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (locErr) {
      console.error("[POST /api/class-locations/id/bonus-rules] loc", locErr);
      return NextResponse.json({ error: locErr.message }, { status: 500 });
    }
    if (!location) {
      return NextResponse.json(
        { error: "Local não encontrado" },
        { status: 404 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("class_location_bonus_rules")
      .insert({
        account_id: ctx.accountId,
        location_id: id,
        ...parsed.value,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[POST /api/class-locations/id/bonus-rules]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ rule: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
