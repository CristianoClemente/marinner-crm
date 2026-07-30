import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  toErrorResponse,
} from "@/lib/auth/account";
import { isInstructorRole } from "@/lib/auth/roles";
import { loadOwnInstructor } from "@/lib/instructors/api-helpers";
import { validateInstructorPatch } from "@/lib/instructors/validate";

/** Self-service: só role instructor exato. */
export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    if (!isInstructorRole(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const own = await loadOwnInstructor(ctx);
    if (!own.ok) return own.response;

    const { data, error } = await ctx.supabase
      .from("instructors")
      .select("*")
      .eq("id", own.instructor.id)
      .single();

    if (error) {
      console.error("[GET /api/instructors/me]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ instructor: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Instrutor pode atualizar campos da própria ficha (exceto status/user).
 * Status permanece sob controle do admin.
 */
export async function PATCH(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    if (!isInstructorRole(ctx.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const own = await loadOwnInstructor(ctx);
    if (!own.ok) return own.response;

    const body = await request.json().catch(() => null);
    const parsed = validateInstructorPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    // Instrutor não altera o próprio status via /me.
    const patch = { ...parsed.value };
    delete patch.status;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nada para atualizar (status só via admin)" },
        { status: 400 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("instructors")
      .update(patch)
      .eq("id", own.instructor.id)
      .eq("user_id", ctx.userId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/instructors/me]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ instructor: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
