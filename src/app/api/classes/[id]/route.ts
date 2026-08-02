import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { collectClassConflictWarnings } from "@/lib/classes/conflicts";
import { mapClassRow, PROCESS_CLASS_SELECT } from "@/lib/classes/map-row";
import { validateClassPatch } from "@/lib/classes/validate";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("process_classes")
      .select(PROCESS_CLASS_SELECT)
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[GET /api/classes/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    }
    return NextResponse.json({
      class: mapClassRow(data as unknown as Record<string, unknown>),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateClassPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: existing, error: exErr } = await ctx.supabase
      .from("process_classes")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (exErr) {
      console.error("[PATCH /api/classes/id] load", exErr);
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }
    if (!existing) {
      return NextResponse.json({ error: "Turma não encontrada." }, { status: 404 });
    }

    if (parsed.value.location_id) {
      const { data: location } = await ctx.supabase
        .from("class_locations")
        .select("id")
        .eq("id", parsed.value.location_id)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (!location) {
        return NextResponse.json({ error: "Local inválido." }, { status: 400 });
      }
    }
    if (parsed.value.instructor_id) {
      const { data: inst } = await ctx.supabase
        .from("instructors")
        .select("id")
        .eq("id", parsed.value.instructor_id)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (!inst) {
        return NextResponse.json({ error: "Instrutor inválido." }, { status: 400 });
      }
    }
    if (parsed.value.equipment_id) {
      const { data: eq } = await ctx.supabase
        .from("equipment")
        .select("id")
        .eq("id", parsed.value.equipment_id)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (!eq) {
        return NextResponse.json(
          { error: "Equipamento inválido." },
          { status: 400 },
        );
      }
    }

    if (
      parsed.value.capacity !== undefined &&
      existing.status === "open"
    ) {
      const { count, error: countErr } = await ctx.supabase
        .from("process_class_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("class_id", id)
        .eq("account_id", ctx.accountId);
      if (countErr) {
        console.error("[PATCH /api/classes/id] count", countErr);
        return NextResponse.json({ error: countErr.message }, { status: 500 });
      }
      if ((count ?? 0) > parsed.value.capacity) {
        return NextResponse.json(
          {
            error:
              "Capacidade menor que o número de alunos já alocados.",
          },
          { status: 400 },
        );
      }
    }

    const patch: Record<string, unknown> = { ...parsed.value };
    if (parsed.value.status === "closed" || parsed.value.status === "canceled") {
      patch.closed_at = new Date().toISOString();
    }
    if (parsed.value.status === "open" && existing.status !== "open") {
      patch.closed_at = null;
    }

    const startsAt =
      typeof patch.starts_at === "string"
        ? patch.starts_at
        : (existing.starts_at as string);
    const instructorId =
      "instructor_id" in patch
        ? (patch.instructor_id as string | null)
        : (existing.instructor_id as string | null);
    const equipmentId =
      "equipment_id" in patch
        ? (patch.equipment_id as string | null)
        : (existing.equipment_id as string | null);

    const warnings = await collectClassConflictWarnings({
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      excludeClassId: id,
      startsAt,
      instructorId,
      equipmentId,
    });

    const { data, error } = await ctx.supabase
      .from("process_classes")
      .update(patch)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select(PROCESS_CLASS_SELECT)
      .single();

    if (error) {
      console.error("[PATCH /api/classes/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      class: mapClassRow(data as unknown as Record<string, unknown>),
      warnings,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
