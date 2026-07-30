import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { loadInstructorInAccount } from "@/lib/instructors/api-helpers";
import { isUuid } from "@/lib/instructors/link-user";

type RouteCtx = { params: Promise<{ id: string; uid: string }> };

export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id, uid } = await params;
    if (!isUuid(uid)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const loaded = await loadInstructorInAccount(ctx, id);
    if (!loaded.ok) return loaded.response;

    const { data, error } = await ctx.supabase
      .from("instructor_unavailability")
      .delete()
      .eq("account_id", ctx.accountId)
      .eq("instructor_id", id)
      .eq("id", uid)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[DELETE /api/instructors/id/unavailability/uid]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Indisponibilidade não encontrada" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
