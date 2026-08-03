import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { emitProcessEvent } from "@/lib/processes/events";
import { PROCESS_SELECT } from "@/lib/processes/process-select";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("agent");
    const body = (await request.json().catch(() => ({}))) as {
      note?: unknown;
      as_won?: unknown;
    };
    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

    const { data: process, error: pErr } = await ctx.supabase
      .from("enrollment_processes")
      .select(
        "*, template:process_templates(has_commercial_outcome)",
      )
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
        { error: "Processo já finalizado." },
        { status: 409 },
      );
    }

    const template = process.template as {
      has_commercial_outcome?: boolean;
    } | null;
    const asWon = body.as_won !== false;
    const fromId = process.current_stage_id;
    const { data: updated, error } = await ctx.supabase
      .from("enrollment_processes")
      .update({
        status: "completed",
        current_stage_id: null,
        completed_at: new Date().toISOString(),
        ...(template?.has_commercial_outcome && asWon
          ? { commercial_status: "won" }
          : {}),
      })
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select(PROCESS_SELECT)
      .single();
    if (error) {
      console.error("[POST complete]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await ctx.supabase.from("process_stage_history").insert({
      account_id: ctx.accountId,
      process_id: id,
      from_stage_id: fromId,
      to_stage_id: null,
      actor_user_id: ctx.userId,
      note:
        note ||
        (template?.has_commercial_outcome && asWon
          ? "Negócio ganho"
          : "Processo concluído"),
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
        commercial_status:
          template?.has_commercial_outcome && asWon ? "won" : null,
        at: new Date().toISOString(),
      },
    });

    return NextResponse.json({ process: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
