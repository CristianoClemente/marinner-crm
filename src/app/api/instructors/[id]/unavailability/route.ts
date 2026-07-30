import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { loadInstructorInAccount } from "@/lib/instructors/api-helpers";
import { validateUnavailabilityCreate } from "@/lib/instructors/validate";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const loaded = await loadInstructorInAccount(ctx, id);
    if (!loaded.ok) return loaded.response;

    const { data, error } = await ctx.supabase
      .from("instructor_unavailability")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("instructor_id", id)
      .order("on_date", { ascending: true });

    if (error) {
      console.error("[GET /api/instructors/id/unavailability]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ unavailability: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const loaded = await loadInstructorInAccount(ctx, id);
    if (!loaded.ok) return loaded.response;

    const body = await request.json().catch(() => null);
    const parsed = validateUnavailabilityCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructor_unavailability")
      .insert({
        account_id: ctx.accountId,
        instructor_id: id,
        ...parsed.value,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe indisponibilidade nesta data" },
          { status: 409 },
        );
      }
      console.error("[POST /api/instructors/id/unavailability]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ unavailability: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
