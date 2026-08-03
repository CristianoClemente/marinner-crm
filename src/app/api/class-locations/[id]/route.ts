import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { validateClassLocationPatch } from "@/lib/class-locations/validate";
import { assertAccountHasAuthority } from "@/lib/class-locations/assert-authority";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;

    const { data, error } = await supabase
      .from("class_locations")
      .select("*, bonus_rules:class_location_bonus_rules(*)")
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/class-locations/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Local não encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ location: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = validateClassLocationPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    if (parsed.value.authority_id != null) {
      const linked = await assertAccountHasAuthority(
        ctx.supabase,
        ctx.accountId,
        parsed.value.authority_id,
      );
      if (!linked.ok) {
        return NextResponse.json({ error: linked.message }, { status: 400 });
      }
    }

    const { data, error } = await ctx.supabase
      .from("class_locations")
      .update(parsed.value)
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/class-locations/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Local não encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ location: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;

    const { data, error } = await ctx.supabase
      .from("class_locations")
      .update({ status: "inactive" })
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[DELETE /api/class-locations/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Local não encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ location: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
