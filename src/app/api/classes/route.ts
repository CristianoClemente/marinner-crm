import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { collectClassConflictWarnings } from "@/lib/classes/conflicts";
import { mapClassRow, PROCESS_CLASS_SELECT } from "@/lib/classes/map-row";
import { validateClassCreate } from "@/lib/classes/validate";

export async function GET(request: Request) {
  try {
    const ctx = await requireRole("viewer");
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const status = url.searchParams.get("status");

    let query = ctx.supabase
      .from("process_classes")
      .select(PROCESS_CLASS_SELECT)
      .eq("account_id", ctx.accountId)
      .order("starts_at", { ascending: true });

    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) {
        query = query.gte("starts_at", d.toISOString());
      }
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) {
        query = query.lte("starts_at", d.toISOString());
      }
    }
    if (status === "open" || status === "closed" || status === "canceled") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/classes]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const classes = (data ?? []).map((row) =>
      mapClassRow(row as unknown as Record<string, unknown>),
    );
    return NextResponse.json({ classes });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateClassCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: stage, error: stageErr } = await ctx.supabase
      .from("process_template_stages")
      .select("id, accepts_classes, account_id")
      .eq("id", parsed.value.template_stage_id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (stageErr) {
      console.error("[POST /api/classes] stage", stageErr);
      return NextResponse.json({ error: stageErr.message }, { status: 500 });
    }
    if (!stage) {
      return NextResponse.json({ error: "Etapa não encontrada." }, { status: 404 });
    }
    if (!stage.accepts_classes) {
      return NextResponse.json(
        { error: "Esta etapa não usa turmas." },
        { status: 400 },
      );
    }

    const { data: location, error: locErr } = await ctx.supabase
      .from("class_locations")
      .select("id")
      .eq("id", parsed.value.location_id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();
    if (locErr || !location) {
      return NextResponse.json({ error: "Local inválido." }, { status: 400 });
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

    const warnings = await collectClassConflictWarnings({
      supabase: ctx.supabase,
      accountId: ctx.accountId,
      startsAt: parsed.value.starts_at,
      instructorId: parsed.value.instructor_id,
      equipmentId: parsed.value.equipment_id,
    });

    const { data, error } = await ctx.supabase
      .from("process_classes")
      .insert({
        account_id: ctx.accountId,
        template_stage_id: parsed.value.template_stage_id,
        location_id: parsed.value.location_id,
        instructor_id: parsed.value.instructor_id,
        equipment_id: parsed.value.equipment_id,
        starts_at: parsed.value.starts_at,
        capacity: parsed.value.capacity,
        name: parsed.value.name,
        status: "open",
        created_by_user_id: ctx.userId,
      })
      .select(PROCESS_CLASS_SELECT)
      .single();

    if (error) {
      console.error("[POST /api/classes]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        class: mapClassRow(data as unknown as Record<string, unknown>),
        warnings,
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
