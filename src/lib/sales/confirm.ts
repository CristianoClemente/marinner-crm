/**
 * Montagem pura da confirmação de venda (sem I/O).
 */

import { applyMovementToQty } from "@/lib/catalog/stock";
import type {
  CatalogItem,
  CatalogItemKind,
  DiscountType,
  PaymentMethod,
} from "@/types";

export interface SaleCartLine {
  catalog_item_id: string;
  qty: number;
  /** Preço unitário usado na linha (pode diferir do catálogo). */
  unit_price: number;
}

export interface PreparedSaleItem {
  catalog_item_id: string;
  kind: CatalogItemKind;
  name: string;
  unit_price: number;
  qty: number;
  line_total: number;
}

export interface PreparedStockDelta {
  catalog_item_id: string;
  qty: number; // negativo = saída
}

export type PrepareSaleError =
  | "empty_cart"
  | "item_missing"
  | "item_inactive"
  | "invalid_qty"
  | "invalid_price"
  | "insufficient_stock"
  | "invalid_payment"
  | "invalid_discount";

const PAYMENTS = new Set<PaymentMethod>(["cash", "pix", "card", "other"]);
const DISCOUNTS = new Set<DiscountType>(["none", "fixed", "percent"]);

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === "string" && PAYMENTS.has(value as PaymentMethod);
}

export function isDiscountType(value: unknown): value is DiscountType {
  return typeof value === "string" && DISCOUNTS.has(value as DiscountType);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula o desconto efetivo em R$ a partir do subtotal e do pedido do operador.
 */
export function computeDiscountAmount(
  subtotal: number,
  discount_type: DiscountType,
  discount_value: number,
):
  | { ok: true; discount_amount: number; discount_value: number }
  | { ok: false; message: string } {
  if (!Number.isFinite(discount_value) || discount_value < 0) {
    return { ok: false, message: "Valor de desconto inválido" };
  }

  if (discount_type === "none") {
    return { ok: true, discount_amount: 0, discount_value: 0 };
  }

  if (discount_type === "fixed") {
    const amount = roundMoney(Math.min(discount_value, subtotal));
    return {
      ok: true,
      discount_amount: amount,
      discount_value: roundMoney(discount_value),
    };
  }

  // percent
  if (discount_value > 100) {
    return { ok: false, message: "Percentual de desconto deve ser até 100" };
  }
  const amount = roundMoney((subtotal * discount_value) / 100);
  return {
    ok: true,
    discount_amount: amount,
    discount_value: roundMoney(discount_value),
  };
}

export function prepareSale(input: {
  lines: SaleCartLine[];
  itemsById: Map<string, CatalogItem>;
  payment_method: unknown;
  contact_id?: string | null;
  discount_type?: unknown;
  discount_value?: unknown;
}):
  | {
      ok: true;
      payment_method: PaymentMethod;
      contact_id: string | null;
      subtotal: number;
      discount_type: DiscountType;
      discount_value: number;
      discount_amount: number;
      total: number;
      items: PreparedSaleItem[];
      stockDeltas: PreparedStockDelta[];
    }
  | { ok: false; error: PrepareSaleError; message: string } {
  if (!isPaymentMethod(input.payment_method)) {
    return {
      ok: false,
      error: "invalid_payment",
      message: "Forma de pagamento inválida",
    };
  }
  if (!input.lines.length) {
    return { ok: false, error: "empty_cart", message: "Carrinho vazio" };
  }

  const rawType = input.discount_type;
  let discount_type: DiscountType = "none";
  if (rawType !== undefined && rawType !== null) {
    if (!isDiscountType(rawType)) {
      return {
        ok: false,
        error: "invalid_discount",
        message: "Tipo de desconto inválido",
      };
    }
    discount_type = rawType;
  }

  const discountValueRaw =
    input.discount_value === undefined || input.discount_value === null
      ? 0
      : typeof input.discount_value === "number"
        ? input.discount_value
        : typeof input.discount_value === "string"
          ? Number(input.discount_value)
          : NaN;

  const items: PreparedSaleItem[] = [];
  const stockDeltas: PreparedStockDelta[] = [];
  const consumeByProduct = new Map<string, number>();

  for (const line of input.lines) {
    if (!Number.isFinite(line.qty) || line.qty <= 0) {
      return {
        ok: false,
        error: "invalid_qty",
        message: "Quantidade inválida no carrinho",
      };
    }
    if (!Number.isFinite(line.unit_price) || line.unit_price < 0) {
      return {
        ok: false,
        error: "invalid_price",
        message: "Preço inválido no carrinho",
      };
    }

    const item = input.itemsById.get(line.catalog_item_id);
    if (!item) {
      return {
        ok: false,
        error: "item_missing",
        message: "Item do catálogo não encontrado",
      };
    }
    if (!item.active) {
      return {
        ok: false,
        error: "item_inactive",
        message: `Item inativo: ${item.name}`,
      };
    }
    if (item.kind === "product" && !Number.isInteger(line.qty)) {
      return {
        ok: false,
        error: "invalid_qty",
        message: `Quantidade de ${item.name} deve ser um número inteiro`,
      };
    }

    const unit_price = roundMoney(line.unit_price);
    const line_total = roundMoney(unit_price * line.qty);

    items.push({
      catalog_item_id: item.id,
      kind: item.kind,
      name: item.name,
      unit_price,
      qty: line.qty,
      line_total,
    });

    if (item.kind === "product") {
      const prev = consumeByProduct.get(item.id) ?? 0;
      consumeByProduct.set(item.id, prev + line.qty);
    }
  }

  for (const [id, consume] of consumeByProduct) {
    const item = input.itemsById.get(id)!;
    const check = applyMovementToQty(item.stock_qty, -consume);
    if (!check.ok) {
      return {
        ok: false,
        error: "insufficient_stock",
        message: `Estoque insuficiente: ${item.name}`,
      };
    }
    stockDeltas.push({ catalog_item_id: id, qty: -consume });
  }

  const subtotal = roundMoney(items.reduce((s, i) => s + i.line_total, 0));

  const disc = computeDiscountAmount(
    subtotal,
    discount_type,
    discountValueRaw,
  );
  if (!disc.ok) {
    return { ok: false, error: "invalid_discount", message: disc.message };
  }

  const total = roundMoney(subtotal - disc.discount_amount);

  const contact_id =
    typeof input.contact_id === "string" && input.contact_id.trim()
      ? input.contact_id.trim()
      : null;

  return {
    ok: true,
    payment_method: input.payment_method,
    contact_id,
    subtotal,
    discount_type,
    discount_value: disc.discount_value,
    discount_amount: disc.discount_amount,
    total,
    items,
    stockDeltas,
  };
}
