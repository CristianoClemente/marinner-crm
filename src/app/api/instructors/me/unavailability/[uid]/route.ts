import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  toErrorResponse,
} from "@/lib/auth/account";
import { isInstructorRole } from "@/lib/auth/roles";
import { loadOwnInstructor } from "@/lib/instructors/api-helpers";
import { isUuid } from "@/lib/instructors/link-user";

type RouteCtx = { params: Promise<{ uid: string }> };

export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await getCurrentAccount();
    if (!isInstructorRole(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    const own = await loadOwnInstructor(ctx);
    if (!own.ok) return own.response;

    const { uid } = await params;
    if (!isUuid(uid)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("instructor_unavailability")
      .delete()
      .eq("instructor_id", own.instructor.id)
      .eq("id", uid)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[DELETE /api/instructors/me/unavailability/uid]", error);
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
