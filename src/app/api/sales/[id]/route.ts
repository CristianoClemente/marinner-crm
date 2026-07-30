import { NextResponse } from "next/server";

import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import type { SaleItem, SaleRefundItem } from "@/types";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteCtx) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { id } = await params;

    const { data, error } = await supabase
      .from("sales")
      .select(
        "*, contact:contacts(id, name, phone), items:sale_items(*), refunds:sale_refunds(*, items:sale_refund_items(*))",
      )
      .eq("account_id", accountId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/sales/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Venda não encontrada" },
        { status: 404 },
      );
    }

    const refundItems: Pick<SaleRefundItem, "sale_item_id" | "qty">[] = [];
    for (const r of data.refunds ?? []) {
      for (const ri of r.items ?? []) {
        refundItems.push({
          sale_item_id: ri.sale_item_id,
          qty: Number(ri.qty),
        });
      }
    }

    const refunded = new Map<string, number>();
    for (const ri of refundItems) {
      refunded.set(
        ri.sale_item_id,
        (refunded.get(ri.sale_item_id) ?? 0) + ri.qty,
      );
    }

    const items = ((data.items ?? []) as SaleItem[]).map((i) => {
      const qty_refunded = refunded.get(i.id) ?? 0;
      return {
        ...i,
        qty_refunded,
        qty_remaining: Number(i.qty) - qty_refunded,
      };
    });

    return NextResponse.json({
      sale: { ...data, items },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
