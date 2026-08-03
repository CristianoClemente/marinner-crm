import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { resolveAdvance, sortStages, isAdvanceMode } from "@/lib/processes/advance";
import { emitProcessEvent } from "@/lib/processes/events";
import {
  fieldSummary,
  requiredMissingLabels,
  type FieldWithValue,
} from "@/lib/processes/field-values";
import { PROCESS_SELECT } from "@/lib/processes/process-select";
import { isUuid } from "@/lib/processes/validate";
import type {
  ProcessFieldValueRow,
  ProcessTemplateStage,
  ProcessTemplateStageField,
} from "@/lib/processes/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("agent");
    const body = (await request.json().catch(() => ({}))) as {
      target_stage_id?: unknown;
      force?: unknown;
      note?: unknown;
    };

    const { data: process, error: pErr } = await ctx.supabase
      .from("enrollment_processes")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (pErr || !process) {
      return NextResponse.json(
        { error: "Processo não encontrado." },
        { status: 404 },
      );
    }
    if (process.status !== "active") {
      return NextResponse.json(
        { error: "Só processos ativos podem avançar." },
        { status: 409 },
      );
    }

    const { data: template } = await ctx.supabase
      .from("process_templates")
      .select("id, block_advance_if_incomplete, advance_mode")
      .eq("account_id", ctx.accountId)
      .eq("id", process.template_id)
      .maybeSingle();

    if (process.current_stage_id) {
      const { data: fields } = await ctx.supabase
        .from("process_template_stage_fields")
        .select("*")
        .eq("account_id", ctx.accountId)
        .eq("stage_id", process.current_stage_id)
        .order("position", { ascending: true });
      const fieldRows = (fields ?? []) as ProcessTemplateStageField[];
      const fieldIds = fieldRows.map((f) => f.id);
      let values: ProcessFieldValueRow[] = [];
      if (fieldIds.length > 0) {
        const { data: vals } = await ctx.supabase
          .from("process_field_values")
          .select("*")
          .eq("account_id", ctx.accountId)
          .eq("process_id", id)
          .in("field_id", fieldIds);
        values = (vals ?? []) as ProcessFieldValueRow[];
      }
      const byField = new Map(values.map((v) => [v.field_id, v]));
      const items: FieldWithValue[] = fieldRows.map((field) => ({
        field,
        value: byField.get(field.id) ?? null,
      }));
      const missing = requiredMissingLabels(items);
      if (
        missing.length > 0 &&
        Boolean(template?.block_advance_if_incomplete)
      ) {
        return NextResponse.json(
          {
            error: "Preencha os campos obrigatórios antes de avançar.",
            missing,
            ...fieldSummary(items),
          },
          { status: 409 },
        );
      }
    }

    const { data: stagesRaw, error: sErr } = await ctx.supabase
      .from("process_template_stages")
      .select("*")
      .eq("template_id", process.template_id)
      .eq("account_id", ctx.accountId);
    if (sErr) {
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
    const stages = sortStages((stagesRaw ?? []) as ProcessTemplateStage[]);

    const resolved = resolveAdvance({
      stages,
      currentStageId: process.current_stage_id,
      targetStageId: isUuid(body.target_stage_id)
        ? body.target_stage_id
        : null,
      force: Boolean(body.force),
      advanceMode: isAdvanceMode(template?.advance_mode)
        ? template.advance_mode
        : "sequential",
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.message }, { status: 400 });
    }

    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
    const fromId = process.current_stage_id;

    if (resolved.complete) {
      const { data: updated, error } = await ctx.supabase
        .from("enrollment_processes")
        .update({
          status: "completed",
          current_stage_id: null,
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("account_id", ctx.accountId)
        .select(PROCESS_SELECT)
        .single();
      if (error) {
        console.error("[POST advance] complete", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      await ctx.supabase.from("process_stage_history").insert({
        account_id: ctx.accountId,
        process_id: id,
        from_stage_id: fromId,
        to_stage_id: null,
        actor_user_id: ctx.userId,
        note: note || "Processo concluído",
      });
      await emitProcessEvent(ctx.supabase, {
        accountId: ctx.accountId,
        eventType: "process.completed",
        payload: {
          account_id: ctx.accountId,
          process_id: id,
          contact_id: process.contact_id,
          template_id: process.template_id,
          actor_user_id: ctx.userId,
          from_stage_id: fromId,
          to_stage_id: null,
          at: new Date().toISOString(),
        },
      });
      return NextResponse.json({ process: updated });
    }

    const next = resolved.next;
    const { data: updated, error } = await ctx.supabase
      .from("enrollment_processes")
      .update({ current_stage_id: next.id })
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select(PROCESS_SELECT)
      .single();
    if (error) {
      console.error("[POST advance]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await ctx.supabase.from("process_stage_history").insert({
      account_id: ctx.accountId,
      process_id: id,
      from_stage_id: fromId,
      to_stage_id: next.id,
      actor_user_id: ctx.userId,
      note,
    });
    await emitProcessEvent(ctx.supabase, {
      accountId: ctx.accountId,
      eventType: "process.stage_changed",
      payload: {
        account_id: ctx.accountId,
        process_id: id,
        contact_id: process.contact_id,
        template_id: process.template_id,
        actor_user_id: ctx.userId,
        from_stage_id: fromId,
        to_stage_id: next.id,
        at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ process: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
