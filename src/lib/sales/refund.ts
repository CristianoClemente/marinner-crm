/**
 * Montagem pura do estorno de venda (sem I/O).
 */

import type {
  CatalogItemKind,
  Sale,
  SaleItem,
  SaleStatus,
} from "@/types";

export interface RefundLineInput {
  sale_item_id: string;
  qty: number;
}

export interface PreparedRefundItem {
  sale_item_id: string;
  catalog_item_id: string;
  kind: CatalogItemKind;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface PreparedStockDelta {
  catalog_item_id: string;
  qty: number; // positivo = devolução
}

export type PrepareRefundError =
  | "sale_cancelled"
  | "empty_refund"
  | "item_missing"
  | "invalid_qty"
  | "qty_exceeds";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function prepareRefund(input: {
  sale: Pick<
    Sale,
    "status" | "subtotal" | "discount_amount"
  >;
  items: SaleItem[];
  /** qty já estornada por sale_item_id */
  refundedQtyByItemId: Map<string, number>;
  /** soma de discount_refunded de estornos anteriores */
  discountAlreadyRefunded: number;
  /** Se null/undefined/[] → estorna toda qty restante. */
  lines?: RefundLineInput[] | null;
}):
  | {
      ok: true;
      items: PreparedRefundItem[];
      stockDeltas: PreparedStockDelta[];
      subtotal_refunded: number;
      discount_refunded: number;
      total_refunded: number;
      next_status: SaleStatus;
    }
  | { ok: false; error: PrepareRefundError; message: string } {
  if (input.sale.status === "cancelled") {
    return {
      ok: false,
      error: "sale_cancelled",
      message: "Venda já está cancelada",
    };
  }

  const itemsById = new Map(input.items.map((i) => [i.id, i]));

  function remaining(item: SaleItem): number {
    const done = input.refundedQtyByItemId.get(item.id) ?? 0;
    return Number(item.qty) - done;
  }

  let requested: RefundLineInput[];
  if (!input.lines || input.lines.length === 0) {
    requested = input.items
      .map((i) => ({ sale_item_id: i.id, qty: remaining(i) }))
      .filter((l) => l.qty > 0);
  } else {
    requested = input.lines;
  }

  if (requested.length === 0) {
    return {
      ok: false,
      error: "empty_refund",
      message: "Nada a estornar nesta venda",
    };
  }

  const prepared: PreparedRefundItem[] = [];
  const stockDeltas: PreparedStockDelta[] = [];
  // Acumula qty pedida nesta operação por item (evita duplicar sale_item_id)
  const qtyThisRefund = new Map<string, number>();

  for (const line of requested) {
    const item = itemsById.get(line.sale_item_id);
    if (!item) {
      return {
        ok: false,
        error: "item_missing",
        message: "Item da venda não encontrado",
      };
    }
    if (!Number.isInteger(line.qty) || line.qty <= 0) {
      return {
        ok: false,
        error: "invalid_qty",
        message: "Quantidade de estorno inválida",
      };
    }

    const prevInRequest = qtyThisRefund.get(item.id) ?? 0;
    const rem = remaining(item) - prevInRequest;
    if (line.qty > rem) {
      return {
        ok: false,
        error: "qty_exceeds",
        message: `Quantidade maior que o restante de ${item.name}`,
      };
    }

    qtyThisRefund.set(item.id, prevInRequest + line.qty);

    const unit_price = roundMoney(Number(item.unit_price));
    const line_total = roundMoney(unit_price * line.qty);

    prepared.push({
      sale_item_id: item.id,
      catalog_item_id: item.catalog_item_id,
      kind: item.kind,
      qty: line.qty,
      unit_price,
      line_total,
    });

    if (item.kind === "product") {
      stockDeltas.push({
        catalog_item_id: item.catalog_item_id,
        qty: line.qty,
      });
    }
  }

  // Mescla deltas do mesmo produto
  const mergedStock = new Map<string, number>();
  for (const d of stockDeltas) {
    mergedStock.set(
      d.catalog_item_id,
      (mergedStock.get(d.catalog_item_id) ?? 0) + d.qty,
    );
  }

  const subtotal_refunded = roundMoney(
    prepared.reduce((s, i) => s + i.line_total, 0),
  );

  const saleSubtotal = Number(input.sale.subtotal);
  const saleDiscount = Number(input.sale.discount_amount);
  const discountLeft = roundMoney(
    saleDiscount - Number(input.discountAlreadyRefunded || 0),
  );

  // Ainda restará qty após este estorno?
  let anyRemainingAfter = false;
  for (const item of input.items) {
    const rem =
      remaining(item) - (qtyThisRefund.get(item.id) ?? 0);
    if (rem > 0) {
      anyRemainingAfter = true;
      break;
    }
  }

  let discount_refunded: number;
  if (saleSubtotal <= 0 || saleDiscount <= 0) {
    discount_refunded = 0;
  } else if (!anyRemainingAfter) {
    // Último estorno: leva o residual de centavos
    discount_refunded = Math.max(0, discountLeft);
  } else {
    discount_refunded = roundMoney(
      (saleDiscount * subtotal_refunded) / saleSubtotal,
    );
    if (discount_refunded > discountLeft) {
      discount_refunded = discountLeft;
    }
  }

  const total_refunded = roundMoney(subtotal_refunded - discount_refunded);
  const next_status: SaleStatus = anyRemainingAfter
    ? "partially_refunded"
    : "cancelled";

  return {
    ok: true,
    items: prepared,
    stockDeltas: [...mergedStock.entries()].map(([catalog_item_id, qty]) => ({
      catalog_item_id,
      qty,
    })),
    subtotal_refunded,
    discount_refunded,
    total_refunded,
    next_status,
  };
}
