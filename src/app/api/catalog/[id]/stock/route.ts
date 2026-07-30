import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { validateStockAdjustment } from "@/lib/catalog/validate";
import type { CatalogItem } from "@/types";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;

    const { data: item } = await supabase
      .from("catalog_items")
      .select("id")
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("stock_movements")
      .select("*")
      .eq("account_id", accountId)
      .eq("catalog_item_id", id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[GET /api/catalog/id/stock]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ movements: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await params;

    const { data: item, error: itemErr } = await ctx.supabase
      .from("catalog_items")
      .select("*")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (itemErr) {
      console.error("[POST /api/catalog/id/stock] item", itemErr);
      return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }
    if (!item) {
      return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = validateStockAdjustment(
      body,
      (item as CatalogItem).kind,
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { error: movErr } = await ctx.supabase.from("stock_movements").insert({
      account_id: ctx.accountId,
      catalog_item_id: id,
      qty: parsed.signed_qty,
      reason: parsed.value.reason,
      note: parsed.value.note,
      created_by: ctx.userId,
    });

    if (movErr) {
      if (movErr.message?.includes("estoque insuficiente")) {
        return NextResponse.json(
          { error: "Estoque insuficiente para este ajuste" },
          { status: 409 },
        );
      }
      console.error("[POST /api/catalog/id/stock]", movErr);
      return NextResponse.json({ error: movErr.message }, { status: 500 });
    }

    const { data: refreshed } = await ctx.supabase
      .from("catalog_items")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ item: refreshed }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
