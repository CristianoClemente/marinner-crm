import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import {
  isLocationStatus,
  validateClassLocationCreate,
} from "@/lib/class-locations/validate";
import { assertAccountHasAuthority } from "@/lib/class-locations/assert-authority";

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const url = new URL(request.url);
    const q = url.searchParams.get("q")?.trim() ?? "";
    const status = url.searchParams.get("status");

    let query = supabase
      .from("class_locations")
      .select("*")
      .eq("account_id", accountId)
      .order("name", { ascending: true });

    if (status && isLocationStatus(status)) {
      query = query.eq("status", status);
    }
    if (q) {
      query = query.or(`name.ilike.%${q}%,cidade.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/class-locations]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ locations: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateClassLocationCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const linked = await assertAccountHasAuthority(
      ctx.supabase,
      ctx.accountId,
      parsed.value.authority_id,
    );
    if (!linked.ok) {
      return NextResponse.json({ error: linked.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("class_locations")
      .insert({
        account_id: ctx.accountId,
        ...parsed.value,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[POST /api/class-locations]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ location: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
