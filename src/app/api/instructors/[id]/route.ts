import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid } from "@/lib/instructors/link-user";
import { validateInstructorPatch } from "@/lib/instructors/validate";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructors")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/instructors/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Instrutor não encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ instructor: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { data: current, error: curErr } = await ctx.supabase
      .from("instructors")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (curErr) {
      console.error("[PATCH /api/instructors/id] current", curErr);
      return NextResponse.json({ error: curErr.message }, { status: 500 });
    }
    if (!current) {
      return NextResponse.json(
        { error: "Instrutor não encontrado" },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = validateInstructorPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructors")
      .update(parsed.value)
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/instructors/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ instructor: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Soft delete → status inactive. */
export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructors")
      .update({ status: "inactive" })
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[DELETE /api/instructors/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Instrutor não encontrado" },
        { status: 404 },
      );
    }
    return NextResponse.json({ instructor: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
