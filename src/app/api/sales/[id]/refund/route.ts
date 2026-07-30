import { NextResponse } from "next/server";

import {
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { prepareRefund } from "@/lib/sales/refund";
import type { Sale, SaleItem } from "@/types";

type RouteCtx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteCtx) {
  try {
    const ctx = await requireRole("agent");
    const { id: saleId } = await params;

    const body = (await request.json().catch(() => null)) as {
      note?: unknown;
      lines?: unknown;
    } | null;

    const { data: sale, error: saleErr } = await ctx.supabase
      .from("sales")
      .select("*, items:sale_items(*)")
      .eq("account_id", ctx.accountId)
      .eq("id", saleId)
      .maybeSingle();

    if (saleErr) {
      console.error("[POST /api/sales/id/refund] sale", saleErr);
      return NextResponse.json({ error: saleErr.message }, { status: 500 });
    }
    if (!sale) {
      return NextResponse.json(
        { error: "Venda não encontrada" },
        { status: 404 },
      );
    }

    const { data: priorRefunds, error: priorErr } = await ctx.supabase
      .from("sale_refunds")
      .select("discount_refunded, items:sale_refund_items(sale_item_id, qty)")
      .eq("sale_id", saleId)
      .eq("account_id", ctx.accountId);

    if (priorErr) {
      console.error("[POST /api/sales/id/refund] prior", priorErr);
      return NextResponse.json({ error: priorErr.message }, { status: 500 });
    }

    const refundedQtyByItemId = new Map<string, number>();
    let discountAlreadyRefunded = 0;
    for (const r of priorRefunds ?? []) {
      discountAlreadyRefunded += Number(r.discount_refunded);
      for (const ri of (r.items as { sale_item_id: string; qty: number }[]) ??
        []) {
        refundedQtyByItemId.set(
          ri.sale_item_id,
          (refundedQtyByItemId.get(ri.sale_item_id) ?? 0) + Number(ri.qty),
        );
      }
    }

    let lines: { sale_item_id: string; qty: number }[] | null = null;
    if (body && Array.isArray(body.lines)) {
      lines = body.lines
        .map((raw) => {
          if (!raw || typeof raw !== "object") return null;
          const l = raw as Record<string, unknown>;
          if (typeof l.sale_item_id !== "string") return null;
          const qty =
            typeof l.qty === "number"
              ? l.qty
              : typeof l.qty === "string"
                ? Number(l.qty)
                : NaN;
          return { sale_item_id: l.sale_item_id, qty };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);
    }

    const prepared = prepareRefund({
      sale: sale as Sale,
      items: (sale.items ?? []) as SaleItem[],
      refundedQtyByItemId,
      discountAlreadyRefunded,
      lines,
    });

    if (!prepared.ok) {
      const status = prepared.error === "sale_cancelled" ? 409 : 400;
      return NextResponse.json({ error: prepared.message }, { status });
    }

    const note =
      body && typeof body.note === "string" && body.note.trim()
        ? body.note.trim()
        : null;

    const { data: refund, error: refundErr } = await ctx.supabase
      .from("sale_refunds")
      .insert({
        account_id: ctx.accountId,
        sale_id: saleId,
        refunded_by: ctx.userId,
        note,
        subtotal_refunded: prepared.subtotal_refunded,
        discount_refunded: prepared.discount_refunded,
        total_refunded: prepared.total_refunded,
      })
      .select("*")
      .single();

    if (refundErr || !refund) {
      console.error("[POST /api/sales/id/refund] insert", refundErr);
      return NextResponse.json(
        { error: refundErr?.message || "Falha ao registrar estorno" },
        { status: 500 },
      );
    }

    const { error: itemsErr } = await ctx.supabase
      .from("sale_refund_items")
      .insert(
        prepared.items.map((i) => ({
          refund_id: refund.id,
          sale_item_id: i.sale_item_id,
          catalog_item_id: i.catalog_item_id,
          qty: i.qty,
          unit_price: i.unit_price,
          line_total: i.line_total,
        })),
      );

    if (itemsErr) {
      console.error("[POST /api/sales/id/refund] items", itemsErr);
      await ctx.supabase.from("sale_refunds").delete().eq("id", refund.id);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    if (prepared.stockDeltas.length > 0) {
      const { error: movErr } = await ctx.supabase.from("stock_movements").insert(
        prepared.stockDeltas.map((d) => ({
          account_id: ctx.accountId,
          catalog_item_id: d.catalog_item_id,
          qty: d.qty,
          reason: "sale_refund" as const,
          sale_id: saleId,
          refund_id: refund.id,
          created_by: ctx.userId,
        })),
      );

      if (movErr) {
        console.error("[POST /api/sales/id/refund] stock", movErr);
        await ctx.supabase.from("sale_refunds").delete().eq("id", refund.id);
        return NextResponse.json({ error: movErr.message }, { status: 500 });
      }
    }

    const { error: statusErr } = await ctx.supabase
      .from("sales")
      .update({ status: prepared.next_status })
      .eq("id", saleId)
      .eq("account_id", ctx.accountId);

    if (statusErr) {
      console.error("[POST /api/sales/id/refund] status", statusErr);
      return NextResponse.json({ error: statusErr.message }, { status: 500 });
    }

    const { data: full } = await ctx.supabase
      .from("sale_refunds")
      .select("*, items:sale_refund_items(*)")
      .eq("id", refund.id)
      .single();

    return NextResponse.json(
      {
        refund: full ?? refund,
        sale_status: prepared.next_status,
      },
      { status: 201 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
