import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { validateCatalogPatch } from "@/lib/catalog/validate";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;
    const { data, error } = await supabase
      .from("catalog_items")
      .select("*")
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[GET /api/catalog/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ item: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const parsed = validateCatalogPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("catalog_items")
      .update(parsed.value)
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "SKU já existe nesta conta" },
          { status: 409 },
        );
      }
      console.error("[PATCH /api/catalog/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ item: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;

    const { data: sold } = await ctx.supabase
      .from("sale_items")
      .select("id")
      .eq("catalog_item_id", id)
      .limit(1)
      .maybeSingle();

    if (sold) {
      const { data, error } = await ctx.supabase
        .from("catalog_items")
        .update({ active: false })
        .eq("account_id", ctx.accountId)
        .eq("id", id)
        .select("*")
        .maybeSingle();
      if (error) {
        console.error("[DELETE /api/catalog/id] soft", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (!data) {
        return NextResponse.json(
          { error: "Item não encontrado" },
          { status: 404 },
        );
      }
      return NextResponse.json({ item: data, soft_deleted: true });
    }

    // Remove movimentos órfãos (ex.: initial) antes do hard delete
    await ctx.supabase
      .from("stock_movements")
      .delete()
      .eq("account_id", ctx.accountId)
      .eq("catalog_item_id", id);

    const { error } = await ctx.supabase
      .from("catalog_items")
      .delete()
      .eq("account_id", ctx.accountId)
      .eq("id", id);

    if (error) {
      // Se ainda há FK (movimento de venda sem sale_items — improvável), soft
      if (error.code === "23503") {
        const { data } = await ctx.supabase
          .from("catalog_items")
          .update({ active: false })
          .eq("account_id", ctx.accountId)
          .eq("id", id)
          .select("*")
          .maybeSingle();
        return NextResponse.json({
          item: data,
          soft_deleted: true,
        });
      }
      console.error("[DELETE /api/catalog/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
