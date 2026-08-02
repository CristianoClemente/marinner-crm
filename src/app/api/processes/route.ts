import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { emitProcessEvent } from "@/lib/processes/events";
import { isProcessStatus, sortStages } from "@/lib/processes/advance";
import { isUuid } from "@/lib/processes/validate";

const PROCESS_SELECT =
  "*, template:process_templates(id, name, catalog_item_id, active), current_stage:process_template_stages!enrollment_processes_current_stage_id_fkey(*), contact:contacts(id, name, phone, cpf)";

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const templateId = url.searchParams.get("template_id");
    const contactId = url.searchParams.get("contact_id");

    let query = supabase
      .from("enrollment_processes")
      .select(PROCESS_SELECT)
      .eq("account_id", accountId)
      .order("opened_at", { ascending: false });

    if (status && isProcessStatus(status)) query = query.eq("status", status);
    if (templateId && isUuid(templateId)) {
      query = query.eq("template_id", templateId);
    }
    if (contactId && isUuid(contactId)) {
      query = query.eq("contact_id", contactId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/processes]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ processes: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("agent");
    const body = (await request.json().catch(() => null)) as {
      contact_id?: unknown;
      template_id?: unknown;
    } | null;

    if (!body || !isUuid(body.contact_id) || !isUuid(body.template_id)) {
      return NextResponse.json(
        { error: "contact_id e template_id são obrigatórios." },
        { status: 400 },
      );
    }

    const { data: contact, error: cErr } = await ctx.supabase
      .from("contacts")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("id", body.contact_id)
      .maybeSingle();
    if (cErr || !contact) {
      return NextResponse.json(
        { error: "Contato não encontrado." },
        { status: 404 },
      );
    }

    const { data: template, error: tErr } = await ctx.supabase
      .from("process_templates")
      .select("id, active")
      .eq("account_id", ctx.accountId)
      .eq("id", body.template_id)
      .maybeSingle();
    if (tErr || !template || !template.active) {
      return NextResponse.json(
        { error: "Template inativo ou não encontrado." },
        { status: 400 },
      );
    }

    const { data: stages, error: sErr } = await ctx.supabase
      .from("process_template_stages")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("template_id", body.template_id)
      .order("position", { ascending: true });
    if (sErr) {
      console.error("[POST /api/processes] stages", sErr);
      return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
    const ordered = sortStages(stages ?? []);
    if (ordered.length === 0) {
      return NextResponse.json(
        { error: "Template sem etapas. Configure as etapas antes." },
        { status: 400 },
      );
    }

    const first = ordered[0];
    const { data: process, error } = await ctx.supabase
      .from("enrollment_processes")
      .insert({
        account_id: ctx.accountId,
        contact_id: body.contact_id,
        template_id: body.template_id,
        current_stage_id: first.id,
        status: "active",
        opened_by_user_id: ctx.userId,
      })
      .select(PROCESS_SELECT)
      .single();

    if (error) {
      console.error("[POST /api/processes]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await emitProcessEvent(ctx.supabase, {
      accountId: ctx.accountId,
      eventType: "process.created",
      payload: {
        account_id: ctx.accountId,
        process_id: process.id,
        contact_id: body.contact_id,
        template_id: body.template_id,
        actor_user_id: ctx.userId,
        from_stage_id: null,
        to_stage_id: first.id,
        at: new Date().toISOString(),
      },
    });

    await ctx.supabase.from("process_stage_history").insert({
      account_id: ctx.accountId,
      process_id: process.id,
      from_stage_id: null,
      to_stage_id: first.id,
      actor_user_id: ctx.userId,
      note: "Processo aberto",
    });

    return NextResponse.json({ process }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
