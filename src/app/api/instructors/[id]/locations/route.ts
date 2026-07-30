import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  loadInstructorInAccount,
  replaceLocations,
} from "@/lib/instructors/api-helpers";
import { isUuid } from "@/lib/instructors/link-user";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const loaded = await loadInstructorInAccount(ctx, id);
    if (!loaded.ok) return loaded.response;

    const { data, error } = await ctx.supabase
      .from("instructor_locations")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("instructor_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/instructors/id/locations]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ locations: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Substitui o conjunto de locais (multi-select). */
export async function PUT(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const loaded = await loadInstructorInAccount(ctx, id);
    if (!loaded.ok) return loaded.response;

    const body = (await request.json().catch(() => null)) as {
      location_ids?: unknown;
    } | null;

    if (!Array.isArray(body?.location_ids)) {
      return NextResponse.json(
        { error: "location_ids deve ser um array" },
        { status: 400 },
      );
    }

    const locationIds: string[] = [];
    const seen = new Set<string>();
    for (const raw of body.location_ids) {
      if (!isUuid(raw)) {
        return NextResponse.json(
          { error: "location_id inválido" },
          { status: 400 },
        );
      }
      if (!seen.has(raw)) {
        seen.add(raw);
        locationIds.push(raw);
      }
    }

    if (locationIds.length > 0) {
      const { data: locs, error: locErr } = await ctx.supabase
        .from("class_locations")
        .select("id")
        .eq("account_id", ctx.accountId)
        .in("id", locationIds);

      if (locErr) {
        console.error("[PUT /api/instructors/id/locations] locs", locErr);
        return NextResponse.json({ error: locErr.message }, { status: 500 });
      }
      if ((locs ?? []).length !== locationIds.length) {
        return NextResponse.json(
          { error: "Um ou mais locais não pertencem a esta conta" },
          { status: 400 },
        );
      }
    }

    const replaced = await replaceLocations(ctx, id, locationIds);
    if (replaced.error) {
      console.error("[PUT /api/instructors/id/locations]", replaced.error);
      return NextResponse.json({ error: replaced.error }, { status: 500 });
    }

    const { data, error } = await ctx.supabase
      .from("instructor_locations")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("instructor_id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ locations: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
