import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid } from "@/lib/processes/validate";
import { validateFieldsReplace } from "@/lib/processes/validate-fields";

type Ctx = { params: Promise<{ id: string; stageId: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id: templateId, stageId } = await context.params;
    if (!isUuid(templateId) || !isUuid(stageId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");

    const { data: stage, error: stageErr } = await ctx.supabase
      .from("process_template_stages")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("template_id", templateId)
      .eq("id", stageId)
      .maybeSingle();
    if (stageErr || !stage) {
      return NextResponse.json(
        { error: "Etapa não encontrada." },
        { status: 404 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("process_template_stage_fields")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("stage_id", stageId)
      .order("position", { ascending: true });
    if (error) {
      console.error("[GET stage fields]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ fields: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Sincroniza campos da etapa: atualiza/insere pelo id quando enviado;
 * remove os que sumiram da lista (cascade apaga valores).
 */
export async function PUT(request: Request, context: Ctx) {
  try {
    const { id: templateId, stageId } = await context.params;
    if (!isUuid(templateId) || !isUuid(stageId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateFieldsReplace(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: stage, error: stageErr } = await ctx.supabase
      .from("process_template_stages")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("template_id", templateId)
      .eq("id", stageId)
      .maybeSingle();
    if (stageErr || !stage) {
      return NextResponse.json(
        { error: "Etapa não encontrada." },
        { status: 404 },
      );
    }

    const { data: existing, error: exErr } = await ctx.supabase
      .from("process_template_stage_fields")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("stage_id", stageId);
    if (exErr) {
      console.error("[PUT stage fields] list", exErr);
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }

    const keepIds = new Set(
      parsed.value.map((f) => f.id).filter((id): id is string => Boolean(id)),
    );
    const toDelete = (existing ?? [])
      .map((r) => r.id as string)
      .filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      const { error: delErr } = await ctx.supabase
        .from("process_template_stage_fields")
        .delete()
        .eq("account_id", ctx.accountId)
        .in("id", toDelete);
      if (delErr) {
        console.error("[PUT stage fields] delete", delErr);
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    // Evita colisão UNIQUE (stage_id, position) ao reordenar.
    const keepList = parsed.value.filter((f) => f.id && keepIds.has(f.id));
    for (let i = 0; i < keepList.length; i++) {
      const f = keepList[i];
      const { error } = await ctx.supabase
        .from("process_template_stage_fields")
        .update({ position: 10_000 + i })
        .eq("id", f.id!)
        .eq("account_id", ctx.accountId);
      if (error) {
        console.error("[PUT stage fields] temp position", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    for (const f of parsed.value) {
      const payload = {
        account_id: ctx.accountId,
        stage_id: stageId,
        label: f.label,
        field_type: f.field_type,
        required: f.required,
        position: f.position,
        config: f.config ?? {},
      };
      if (f.id && keepIds.has(f.id)) {
        const { error } = await ctx.supabase
          .from("process_template_stage_fields")
          .update(payload)
          .eq("id", f.id)
          .eq("account_id", ctx.accountId);
        if (error) {
          console.error("[PUT stage fields] update", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        const { error } = await ctx.supabase
          .from("process_template_stage_fields")
          .insert(payload);
        if (error) {
          console.error("[PUT stage fields] insert", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    const { data, error } = await ctx.supabase
      .from("process_template_stage_fields")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("stage_id", stageId)
      .order("position", { ascending: true });
    if (error) {
      console.error("[PUT stage fields] reload", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ fields: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
