import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

const ENROLLMENT_SELECT = `
  *,
  process:enrollment_processes(
    id,
    status,
    current_stage_id,
    contact:contacts(id, name, phone)
  )
`.replace(/\s+/g, " ");

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");

    const { data: clazz, error: classErr } = await ctx.supabase
      .from("process_classes")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (classErr || !clazz) {
      return NextResponse.json(
        { error: classErr?.message ?? "Turma não encontrada." },
        { status: classErr ? 500 : 404 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("process_class_enrollments")
      .select(ENROLLMENT_SELECT)
      .eq("account_id", ctx.accountId)
      .eq("class_id", id)
      .order("enrolled_at", { ascending: true });
    if (error) {
      console.error("[GET /api/classes/id/enrollments]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ enrollments: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const processId =
      body && typeof body === "object"
        ? (body as { process_id?: unknown }).process_id
        : undefined;
    if (typeof processId !== "string" || !isUuid(processId)) {
      return NextResponse.json({ error: "Processo inválido." }, { status: 400 });
    }

    const { data: clazz, error: classErr } = await ctx.supabase
      .from("process_classes")
      .select("id, template_stage_id, capacity, status")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (classErr) {
      console.error("[POST enrollments] class", classErr);
      return NextResponse.json({ error: classErr.message }, { status: 500 });
    }
    if (!clazz) {
      return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    }
    if (clazz.status !== "open") {
      return NextResponse.json(
        { error: "Só é possível alocar em turmas abertas." },
        { status: 400 },
      );
    }

    const { data: process, error: procErr } = await ctx.supabase
      .from("enrollment_processes")
      .select("id, status, current_stage_id")
      .eq("account_id", ctx.accountId)
      .eq("id", processId)
      .maybeSingle();
    if (procErr || !process) {
      return NextResponse.json({ error: "Processo não encontrado." }, { status: 404 });
    }
    if (process.status !== "active") {
      return NextResponse.json(
        { error: "Processo precisa estar ativo." },
        { status: 400 },
      );
    }
    if (process.current_stage_id !== clazz.template_stage_id) {
      return NextResponse.json(
        { error: "Processo não está na etapa desta turma." },
        { status: 400 },
      );
    }

    const { count, error: countErr } = await ctx.supabase
      .from("process_class_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id)
      .eq("account_id", ctx.accountId);
    if (countErr) {
      console.error("[POST enrollments] count", countErr);
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    if ((count ?? 0) >= clazz.capacity) {
      return NextResponse.json({ error: "Turma sem vagas." }, { status: 400 });
    }

    const { data: openClasses } = await ctx.supabase
      .from("process_classes")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("template_stage_id", clazz.template_stage_id)
      .eq("status", "open")
      .neq("id", id);
    const otherIds = (openClasses ?? []).map((c) => c.id as string);
    if (otherIds.length > 0) {
      const { data: conflict } = await ctx.supabase
        .from("process_class_enrollments")
        .select("id")
        .eq("account_id", ctx.accountId)
        .eq("process_id", processId)
        .in("class_id", otherIds)
        .limit(1)
        .maybeSingle();
      if (conflict) {
        return NextResponse.json(
          {
            error:
              "Aluno já está em outra turma aberta desta etapa.",
          },
          { status: 400 },
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from("process_class_enrollments")
      .insert({
        account_id: ctx.accountId,
        class_id: id,
        process_id: processId,
        enrolled_by_user_id: ctx.userId,
      })
      .select(ENROLLMENT_SELECT)
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Aluno já alocado nesta turma." },
          { status: 409 },
        );
      }
      console.error("[POST enrollments]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ enrollment: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");
    const url = new URL(request.url);
    const enrollmentId = url.searchParams.get("enrollment_id");
    const processId = url.searchParams.get("process_id");

    if (enrollmentId && isUuid(enrollmentId)) {
      const { error } = await ctx.supabase
        .from("process_class_enrollments")
        .delete()
        .eq("account_id", ctx.accountId)
        .eq("class_id", id)
        .eq("id", enrollmentId);
      if (error) {
        console.error("[DELETE enrollments]", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (processId && isUuid(processId)) {
      const { error } = await ctx.supabase
        .from("process_class_enrollments")
        .delete()
        .eq("account_id", ctx.accountId)
        .eq("class_id", id)
        .eq("process_id", processId);
      if (error) {
        console.error("[DELETE enrollments] process", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Informe enrollment_id ou process_id." },
      { status: 400 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
