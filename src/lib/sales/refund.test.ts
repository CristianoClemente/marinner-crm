import { describe, expect, it } from "vitest";
import { prepareRefund } from "./refund";
import type { SaleItem } from "@/types";

function saleItem(
  partial: Partial<SaleItem> &
    Pick<SaleItem, "id" | "catalog_item_id" | "kind" | "name">,
): SaleItem {
  return {
    sale_id: "sale-1",
    unit_price: 100,
    qty: 2,
    line_total: 200,
    ...partial,
  };
}

describe("prepareRefund", () => {
  const product = saleItem({
    id: "si-p",
    catalog_item_id: "p1",
    kind: "product",
    name: "Colete",
    unit_price: 100,
    qty: 2,
    line_total: 200,
  });
  const service = saleItem({
    id: "si-s",
    catalog_item_id: "s1",
    kind: "service",
    name: "Curso",
    unit_price: 500,
    qty: 1,
    line_total: 500,
  });

  it("estorno parcial com desconto proporcional", () => {
    const r = prepareRefund({
      sale: {
        status: "confirmed",
        subtotal: 700,
        discount_amount: 70,
      },
      items: [product, service],
      refundedQtyByItemId: new Map(),
      discountAlreadyRefunded: 0,
      lines: [{ sale_item_id: "si-p", qty: 1 }],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.subtotal_refunded).toBe(100);
    expect(r.discount_refunded).toBe(10); // 70 * 100/700
    expect(r.total_refunded).toBe(90);
    expect(r.next_status).toBe("partially_refunded");
    expect(r.stockDeltas).toEqual([{ catalog_item_id: "p1", qty: 1 }]);
  });

  it("último estorno ajusta centavos do desconto", () => {
    // Primeiro: 1 unidade do produto → desconto 10
    // Restante: 1 produto + serviço = 600; desconto left 60
    const r = prepareRefund({
      sale: {
        status: "partially_refunded",
        subtotal: 700,
        discount_amount: 70,
      },
      items: [product, service],
      refundedQtyByItemId: new Map([["si-p", 1]]),
      discountAlreadyRefunded: 10,
      lines: null, // resto tudo
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.subtotal_refunded).toBe(600);
    expect(r.discount_refunded).toBe(60);
    expect(r.total_refunded).toBe(540);
    expect(r.next_status).toBe("cancelled");
  });

  it("estorno total sem lines → cancelled e devolve estoque só de produto", () => {
    const r = prepareRefund({
      sale: {
        status: "confirmed",
        subtotal: 700,
        discount_amount: 0,
      },
      items: [product, service],
      refundedQtyByItemId: new Map(),
      discountAlreadyRefunded: 0,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next_status).toBe("cancelled");
    expect(r.stockDeltas).toEqual([{ catalog_item_id: "p1", qty: 2 }]);
    expect(r.items).toHaveLength(2);
  });

  it("rejeita qty maior que o restante", () => {
    const r = prepareRefund({
      sale: {
        status: "confirmed",
        subtotal: 200,
        discount_amount: 0,
      },
      items: [product],
      refundedQtyByItemId: new Map([["si-p", 1]]),
      discountAlreadyRefunded: 0,
      lines: [{ sale_item_id: "si-p", qty: 2 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("qty_exceeds");
  });

  it("rejeita venda já cancelada", () => {
    const r = prepareRefund({
      sale: {
        status: "cancelled",
        subtotal: 200,
        discount_amount: 0,
      },
      items: [product],
      refundedQtyByItemId: new Map(),
      discountAlreadyRefunded: 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe("sale_cancelled");
  });
});
