import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid, validateStagesReplace } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("process_template_stages")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("template_id", id)
      .order("position", { ascending: true });
    if (error) {
      console.error("[GET /api/process-templates/id/stages]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ stages: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** Sincroniza etapas preservando id (campos da fatia 2 dependem disso). */
export async function PUT(request: Request, context: Ctx) {
  try {
    const { id: templateId } = await context.params;
    if (!isUuid(templateId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateStagesReplace(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: tpl, error: tplErr } = await ctx.supabase
      .from("process_templates")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("id", templateId)
      .maybeSingle();
    if (tplErr || !tpl) {
      return NextResponse.json(
        { error: "Template não encontrado." },
        { status: 404 },
      );
    }

    const { data: existing, error: exErr } = await ctx.supabase
      .from("process_template_stages")
      .select("id")
      .eq("account_id", ctx.accountId)
      .eq("template_id", templateId);
    if (exErr) {
      console.error("[PUT stages] list", exErr);
      return NextResponse.json({ error: exErr.message }, { status: 500 });
    }

    const keepIds = new Set(
      parsed.value.map((s) => s.id).filter((id): id is string => Boolean(id)),
    );
    const toDelete = (existing ?? [])
      .map((r) => r.id as string)
      .filter((id) => !keepIds.has(id));

    if (toDelete.length > 0) {
      const { error: delErr } = await ctx.supabase
        .from("process_template_stages")
        .delete()
        .eq("account_id", ctx.accountId)
        .in("id", toDelete);
      if (delErr) {
        console.error("[PUT stages] delete", delErr);
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
    }

    const keepList = parsed.value.filter((s) => s.id && keepIds.has(s.id));
    for (let i = 0; i < keepList.length; i++) {
      const { error } = await ctx.supabase
        .from("process_template_stages")
        .update({ position: 10_000 + i })
        .eq("id", keepList[i].id!)
        .eq("account_id", ctx.accountId);
      if (error) {
        console.error("[PUT stages] temp position", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    for (const s of parsed.value) {
      const payload = {
        account_id: ctx.accountId,
        template_id: templateId,
        name: s.name,
        position: s.position,
        allow_skip: s.allow_skip,
        accepts_classes: s.accepts_classes,
      };
      if (s.id && keepIds.has(s.id)) {
        const { error } = await ctx.supabase
          .from("process_template_stages")
          .update(payload)
          .eq("id", s.id)
          .eq("account_id", ctx.accountId);
        if (error) {
          console.error("[PUT stages] update", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      } else {
        const { error } = await ctx.supabase
          .from("process_template_stages")
          .insert(payload);
        if (error) {
          console.error("[PUT stages] insert", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    const { data, error } = await ctx.supabase
      .from("process_template_stages")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("template_id", templateId)
      .order("position", { ascending: true });

    if (error) {
      console.error("[PUT /api/process-templates/id/stages]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ stages: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
