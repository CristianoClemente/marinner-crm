import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { prepareSale } from "@/lib/sales/confirm";
import type { CatalogItem } from "@/types";

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const url = new URL(request.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 50) || 50,
      100,
    );

    const { data, error } = await supabase
      .from("sales")
      .select(
        "*, contact:contacts(id, name, phone), items:sale_items(*), refunds:sale_refunds(total_refunded)",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[GET /api/sales]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ sales: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("agent");
    const body = (await request.json().catch(() => null)) as {
      lines?: unknown;
      payment_method?: unknown;
      contact_id?: unknown;
      discount_type?: unknown;
      discount_value?: unknown;
    } | null;

    if (!body || !Array.isArray(body.lines)) {
      return NextResponse.json({ error: "Body inválido" }, { status: 400 });
    }

    const lines = body.lines
      .map((raw) => {
        if (!raw || typeof raw !== "object") return null;
        const l = raw as Record<string, unknown>;
        if (typeof l.catalog_item_id !== "string") return null;
        const qty =
          typeof l.qty === "number"
            ? l.qty
            : typeof l.qty === "string"
              ? Number(l.qty)
              : NaN;
        const unit_price =
          typeof l.unit_price === "number"
            ? l.unit_price
            : typeof l.unit_price === "string"
              ? Number(l.unit_price)
              : NaN;
        return {
          catalog_item_id: l.catalog_item_id,
          qty,
          unit_price,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    const ids = [...new Set(lines.map((l) => l.catalog_item_id))];
    const { data: catalogRows, error: catErr } = await ctx.supabase
      .from("catalog_items")
      .select("*")
      .eq("account_id", ctx.accountId)
      .in("id", ids);

    if (catErr) {
      console.error("[POST /api/sales] catalog", catErr);
      return NextResponse.json({ error: catErr.message }, { status: 500 });
    }

    const itemsById = new Map(
      ((catalogRows ?? []) as CatalogItem[]).map((i) => [i.id, i]),
    );

    const prepared = prepareSale({
      lines,
      itemsById,
      payment_method: body.payment_method,
      contact_id:
        typeof body.contact_id === "string" ? body.contact_id : null,
      discount_type: body.discount_type,
      discount_value: body.discount_value,
    });

    if (!prepared.ok) {
      const status =
        prepared.error === "insufficient_stock" ? 409 : 400;
      return NextResponse.json(
        { error: prepared.message },
        { status },
      );
    }

    const { data: code, error: codeErr } = await ctx.supabase.rpc(
      "allocate_sale_code",
      { p_account_id: ctx.accountId },
    );

    if (codeErr || typeof code !== "string") {
      console.error("[POST /api/sales] code", codeErr);
      return NextResponse.json(
        { error: codeErr?.message || "Falha ao gerar código da venda" },
        { status: 500 },
      );
    }

    const { data: sale, error: saleErr } = await ctx.supabase
      .from("sales")
      .insert({
        account_id: ctx.accountId,
        code,
        contact_id: prepared.contact_id,
        payment_method: prepared.payment_method,
        subtotal: prepared.subtotal,
        discount_type: prepared.discount_type,
        discount_value: prepared.discount_value,
        discount_amount: prepared.discount_amount,
        total: prepared.total,
        sold_by: ctx.userId,
      })
      .select("*")
      .single();

    if (saleErr) {
      console.error("[POST /api/sales] sale", saleErr);
      return NextResponse.json({ error: saleErr.message }, { status: 500 });
    }

    const { error: itemsErr } = await ctx.supabase.from("sale_items").insert(
      prepared.items.map((i) => ({
        sale_id: sale.id,
        catalog_item_id: i.catalog_item_id,
        kind: i.kind,
        name: i.name,
        unit_price: i.unit_price,
        qty: i.qty,
        line_total: i.line_total,
      })),
    );

    if (itemsErr) {
      console.error("[POST /api/sales] items", itemsErr);
      await ctx.supabase.from("sales").delete().eq("id", sale.id);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    if (prepared.stockDeltas.length > 0) {
      const { error: movErr } = await ctx.supabase
        .from("stock_movements")
        .insert(
          prepared.stockDeltas.map((d) => ({
            account_id: ctx.accountId,
            catalog_item_id: d.catalog_item_id,
            qty: d.qty,
            reason: "sale" as const,
            sale_id: sale.id,
            created_by: ctx.userId,
          })),
        );

      if (movErr) {
        console.error("[POST /api/sales] stock", movErr);
        await ctx.supabase.from("sales").delete().eq("id", sale.id);
        const status = movErr.message?.includes("estoque insuficiente")
          ? 409
          : 500;
        return NextResponse.json(
          {
            error:
              status === 409
                ? "Estoque insuficiente"
                : movErr.message,
          },
          { status },
        );
      }
    }

    const { data: full } = await ctx.supabase
      .from("sales")
      .select("*, contact:contacts(id, name, phone), items:sale_items(*)")
      .eq("id", sale.id)
      .single();

    return NextResponse.json({ sale: full ?? sale }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
