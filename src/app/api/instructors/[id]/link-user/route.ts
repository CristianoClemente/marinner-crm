import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  evaluateLinkUser,
  isUuid,
} from "@/lib/instructors/link-user";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * Vincula um membro existente (role instructor) à ficha.
 * Preferência B do spec: vínculo manual após aceite de convite.
 */
export async function POST(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as {
      user_id?: unknown;
    } | null;
    if (!isUuid(body?.user_id)) {
      return NextResponse.json(
        { error: "user_id inválido" },
        { status: 400 },
      );
    }
    const userId = body.user_id;

    const { data: instructor, error: instErr } = await ctx.supabase
      .from("instructors")
      .select("id, user_id")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (instErr) {
      console.error("[POST /api/instructors/id/link-user] load", instErr);
      return NextResponse.json({ error: instErr.message }, { status: 500 });
    }
    if (!instructor) {
      return NextResponse.json(
        { error: "Instrutor não encontrado" },
        { status: 404 },
      );
    }

    // Idempotente: já vinculado ao mesmo user.
    if (instructor.user_id === userId) {
      const { data } = await ctx.supabase
        .from("instructors")
        .select("*")
        .eq("id", id)
        .single();
      return NextResponse.json({ instructor: data });
    }

    const { data: profile, error: profErr } = await ctx.supabase
      .from("profiles")
      .select("account_id, account_role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profErr) {
      console.error("[POST /api/instructors/id/link-user] profile", profErr);
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    const { data: other, error: otherErr } = await ctx.supabase
      .from("instructors")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("user_id", userId)
      .neq("id", id)
      .maybeSingle();

    if (otherErr) {
      console.error("[POST /api/instructors/id/link-user] other", otherErr);
      return NextResponse.json({ error: otherErr.message }, { status: 500 });
    }

    const verdict = evaluateLinkUser({
      accountId: ctx.accountId,
      instructorUserId: instructor.user_id,
      targetProfile: profile,
      otherInstructorId: other?.id ?? null,
    });

    if (!verdict.ok) {
      const status =
        verdict.error === "instructor_already_linked" ||
        verdict.error === "already_linked_elsewhere"
          ? 409
          : 400;
      return NextResponse.json(
        { error: verdict.message, code: verdict.error },
        { status },
      );
    }

    const { data, error } = await ctx.supabase
      .from("instructors")
      .update({ user_id: userId })
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      // Unique violation → race com outro vínculo.
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "Este usuário já está vinculado a outro instrutor",
            code: "already_linked_elsewhere",
          },
          { status: 409 },
        );
      }
      console.error("[POST /api/instructors/id/link-user] update", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ instructor: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
