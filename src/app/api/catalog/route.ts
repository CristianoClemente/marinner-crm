import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { isCatalogItemKind, validateCatalogCreate } from "@/lib/catalog/validate";

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind");
    const q = url.searchParams.get("q")?.trim() ?? "";
    const activeParam = url.searchParams.get("active");

    let query = supabase
      .from("catalog_items")
      .select("*")
      .eq("account_id", accountId)
      .order("name", { ascending: true });

    if (kind && isCatalogItemKind(kind)) {
      query = query.eq("kind", kind);
    }
    if (activeParam === "true") query = query.eq("active", true);
    if (activeParam === "false") query = query.eq("active", false);
    if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/catalog]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateCatalogCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { value } = parsed;
    const { data: item, error } = await ctx.supabase
      .from("catalog_items")
      .insert({
        account_id: ctx.accountId,
        kind: value.kind,
        name: value.name,
        description: value.description,
        sku: value.sku,
        unit_price: value.unit_price,
        stock_qty: 0,
        active: value.active,
      })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "SKU já existe nesta conta" },
          { status: 409 },
        );
      }
      console.error("[POST /api/catalog]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (value.kind === "product" && value.initial_stock > 0) {
      const { error: movErr } = await ctx.supabase
        .from("stock_movements")
        .insert({
          account_id: ctx.accountId,
          catalog_item_id: item.id,
          qty: value.initial_stock,
          reason: "initial",
          note: "Estoque inicial",
          created_by: ctx.userId,
        });
      if (movErr) {
        console.error("[POST /api/catalog] initial stock", movErr);
        return NextResponse.json(
          { error: movErr.message },
          { status: 500 },
        );
      }
      const { data: refreshed } = await ctx.supabase
        .from("catalog_items")
        .select("*")
        .eq("id", item.id)
        .single();
      return NextResponse.json({ item: refreshed ?? item }, { status: 201 });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
