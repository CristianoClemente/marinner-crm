import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Processos ativos na etapa da turma, ainda não em outra turma aberta
 * da mesma etapa.
 */
export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");

    const { data: clazz, error: classErr } = await ctx.supabase
      .from("process_classes")
      .select("id, template_stage_id, status")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (classErr) {
      console.error("[GET /api/classes/id/pool] class", classErr);
      return NextResponse.json({ error: classErr.message }, { status: 500 });
    }
    if (!clazz) {
      return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    }

    const { data: processes, error: procErr } = await ctx.supabase
      .from("enrollment_processes")
      .select(
        "id, status, current_stage_id, contact:contacts(id, name, phone)",
      )
      .eq("account_id", ctx.accountId)
      .eq("status", "active")
      .eq("current_stage_id", clazz.template_stage_id)
      .order("opened_at", { ascending: true });
    if (procErr) {
      console.error("[GET /api/classes/id/pool] processes", procErr);
      return NextResponse.json({ error: procErr.message }, { status: 500 });
    }

    const { data: openClasses, error: openErr } = await ctx.supabase
      .from("process_classes")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("template_stage_id", clazz.template_stage_id)
      .eq("status", "open");
    if (openErr) {
      console.error("[GET /api/classes/id/pool] open", openErr);
      return NextResponse.json({ error: openErr.message }, { status: 500 });
    }

    const openIds = (openClasses ?? []).map((c) => c.id as string);
    const enrolledElsewhere = new Set<string>();
    if (openIds.length > 0) {
      const { data: enrollments, error: enrErr } = await ctx.supabase
        .from("process_class_enrollments")
        .select("process_id, class_id")
        .eq("account_id", ctx.accountId)
        .in("class_id", openIds);
      if (enrErr) {
        console.error("[GET /api/classes/id/pool] enrollments", enrErr);
        return NextResponse.json({ error: enrErr.message }, { status: 500 });
      }
      for (const row of enrollments ?? []) {
        if (row.class_id !== id) {
          enrolledElsewhere.add(row.process_id as string);
        }
      }
    }

    const { data: inThis, error: inErr } = await ctx.supabase
      .from("process_class_enrollments")
      .select("process_id")
      .eq("account_id", ctx.accountId)
      .eq("class_id", id);
    if (inErr) {
      console.error("[GET /api/classes/id/pool] inThis", inErr);
      return NextResponse.json({ error: inErr.message }, { status: 500 });
    }
    const inThisSet = new Set((inThis ?? []).map((r) => r.process_id as string));

    const pool = (processes ?? []).filter(
      (p) => !enrolledElsewhere.has(p.id) && !inThisSet.has(p.id),
    );

    return NextResponse.json({ pool });
  } catch (err) {
    return toErrorResponse(err);
  }
}
