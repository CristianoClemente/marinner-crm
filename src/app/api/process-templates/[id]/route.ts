import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  isUuid,
  requireActiveCatalogService,
} from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("process_templates")
      .select(
        "*, stages:process_template_stages(*), catalog_item:catalog_items(id, name)",
      )
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[GET /api/process-templates/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Template não encontrado." },
        { status: 404 },
      );
    }
    const stages = Array.isArray(data.stages)
      ? [...data.stages].sort(
          (a: { position: number }, b: { position: number }) =>
            a.position - b.position,
        )
      : [];
    return NextResponse.json({ template: { ...data, stages } });
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
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if ("name" in b) {
      if (typeof b.name !== "string" || !b.name.trim()) {
        return NextResponse.json(
          { error: "Nome é obrigatório." },
          { status: 400 },
        );
      }
      patch.name = b.name.trim().slice(0, 120);
    }
    if ("active" in b) patch.active = Boolean(b.active);
    if ("block_advance_if_incomplete" in b) {
      patch.block_advance_if_incomplete = Boolean(b.block_advance_if_incomplete);
    }
    if ("advance_mode" in b) {
      if (b.advance_mode !== "free" && b.advance_mode !== "sequential") {
        return NextResponse.json(
          { error: "Modo de avanço inválido." },
          { status: 400 },
        );
      }
      patch.advance_mode = b.advance_mode;
    }
    if ("has_monetary_value" in b) {
      patch.has_monetary_value = Boolean(b.has_monetary_value);
    }
    if ("has_commercial_outcome" in b) {
      patch.has_commercial_outcome = Boolean(b.has_commercial_outcome);
    }
    if ("requires_catalog_item" in b) {
      patch.requires_catalog_item = Boolean(b.requires_catalog_item);
    }
    if ("habilitation_kind" in b) {
      if (b.habilitation_kind === null || b.habilitation_kind === "") {
        patch.habilitation_kind = null;
      } else if (
        b.habilitation_kind === "arrais" ||
        b.habilitation_kind === "motonauta"
      ) {
        patch.habilitation_kind = b.habilitation_kind;
      } else {
        return NextResponse.json(
          { error: "habilitation_kind inválido." },
          { status: 400 },
        );
      }
    }
    if ("catalog_item_id" in b) {
      if (b.catalog_item_id === null || b.catalog_item_id === "") {
        patch.catalog_item_id = null;
      } else if (!isUuid(b.catalog_item_id)) {
        return NextResponse.json(
          { error: "Item do catálogo inválido." },
          { status: 400 },
        );
      } else {
        const service = await requireActiveCatalogService(
          ctx.supabase,
          ctx.accountId,
          b.catalog_item_id,
        );
        if (!service.ok) {
          return NextResponse.json(
            { error: service.message },
            { status: service.status },
          );
        }
        patch.catalog_item_id = b.catalog_item_id;
      }
    }

    const requires =
      "requires_catalog_item" in patch
        ? Boolean(patch.requires_catalog_item)
        : undefined;
    const catalogId =
      "catalog_item_id" in patch ? patch.catalog_item_id : undefined;
    if (requires === true && catalogId === null) {
      return NextResponse.json(
        { error: "Item do catálogo é obrigatório neste funil." },
        { status: 400 },
      );
    }
    if (requires === true && catalogId === undefined) {
      const { data: current } = await ctx.supabase
        .from("process_templates")
        .select("catalog_item_id")
        .eq("account_id", ctx.accountId)
        .eq("id", id)
        .maybeSingle();
      if (!current?.catalog_item_id) {
        return NextResponse.json(
          { error: "Item do catálogo é obrigatório neste funil." },
          { status: 400 },
        );
      }
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nada para atualizar." },
        { status: 400 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("process_templates")
      .update(patch)
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select(
        "*, stages:process_template_stages(*), catalog_item:catalog_items(id, name)",
      )
      .maybeSingle();

    if (error) {
      console.error("[PATCH /api/process-templates/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Template não encontrado." },
        { status: 404 },
      );
    }
    return NextResponse.json({ template: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("admin");

    const { count } = await ctx.supabase
      .from("enrollment_processes")
      .select("id", { count: "exact", head: true })
      .eq("account_id", ctx.accountId)
      .eq("template_id", id)
      .eq("status", "active");

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Há processos ativos neste template. Cancele-os ou desative o template.",
        },
        { status: 409 },
      );
    }

    const { error } = await ctx.supabase
      .from("process_templates")
      .delete()
      .eq("account_id", ctx.accountId)
      .eq("id", id);

    if (error) {
      console.error("[DELETE /api/process-templates/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
