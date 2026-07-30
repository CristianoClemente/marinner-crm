/**
 * Validação de itens do catálogo e ajustes de estoque.
 */

import type { CatalogItemKind, StockMovementReason } from '@/types';

export const CATALOG_NAME_MAX = 120;
export const CATALOG_SKU_MAX = 64;
export const CATALOG_DESC_MAX = 2000;

const KIND_SET = new Set<CatalogItemKind>(['product', 'service']);

const ADJUST_REASONS = new Set<StockMovementReason>([
  'adjustment_in',
  'adjustment_out',
  'correction',
]);

export function isCatalogItemKind(value: unknown): value is CatalogItemKind {
  return typeof value === 'string' && KIND_SET.has(value as CatalogItemKind);
}

/** Trim + upper-case leve; vazio vira null. */
export function normalizeSku(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return null;
  const sku = raw.trim().toUpperCase();
  return sku.length === 0 ? null : sku;
}

export type CatalogValidateError =
  | 'invalid_kind'
  | 'empty_name'
  | 'name_too_long'
  | 'sku_too_long'
  | 'invalid_price'
  | 'invalid_stock'
  | 'service_with_stock'
  | 'desc_too_long';

export interface CatalogCreateInput {
  kind: CatalogItemKind;
  name: string;
  description: string | null;
  sku: string | null;
  unit_price: number;
  /** Só produto; serviços forçam 0. Quantidade inicial → movimento `initial`. */
  initial_stock: number;
  active: boolean;
}

export function validateCatalogCreate(
  body: unknown
):
  | { ok: true; value: CatalogCreateInput }
  | { ok: false; error: CatalogValidateError; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_kind', message: 'Body inválido' };
  }
  const b = body as Record<string, unknown>;

  if (!isCatalogItemKind(b.kind)) {
    return {
      ok: false,
      error: 'invalid_kind',
      message: 'Tipo deve ser product ou service',
    };
  }

  if (typeof b.name !== 'string' || b.name.trim().length === 0) {
    return { ok: false, error: 'empty_name', message: 'Nome é obrigatório' };
  }
  const name = b.name.trim();
  if (name.length > CATALOG_NAME_MAX) {
    return { ok: false, error: 'name_too_long', message: 'Nome muito longo' };
  }

  let description: string | null = null;
  if (b.description !== undefined && b.description !== null) {
    if (typeof b.description !== 'string') {
      return {
        ok: false,
        error: 'desc_too_long',
        message: 'Descrição inválida',
      };
    }
    description = b.description.trim() || null;
    if (description && description.length > CATALOG_DESC_MAX) {
      return {
        ok: false,
        error: 'desc_too_long',
        message: 'Descrição muito longa',
      };
    }
  }

  const sku = normalizeSku(b.sku ?? null);
  if (sku && sku.length > CATALOG_SKU_MAX) {
    return { ok: false, error: 'sku_too_long', message: 'SKU muito longo' };
  }

  const unit_price =
    typeof b.unit_price === 'number'
      ? b.unit_price
      : typeof b.unit_price === 'string'
        ? Number(b.unit_price)
        : NaN;
  if (!Number.isFinite(unit_price) || unit_price < 0) {
    return {
      ok: false,
      error: 'invalid_price',
      message: 'Preço inválido',
    };
  }

  let initial_stock = 0;
  if (b.kind === 'product' && 'initial_stock' in b && b.initial_stock != null) {
    const n =
      typeof b.initial_stock === 'number'
        ? b.initial_stock
        : typeof b.initial_stock === 'string'
          ? Number(b.initial_stock)
          : NaN;
    // Estoque é contagem de unidades: sempre inteiro.
    if (!Number.isInteger(n) || n < 0) {
      return {
        ok: false,
        error: 'invalid_stock',
        message: 'Estoque inicial deve ser um número inteiro',
      };
    }
    initial_stock = n;
  }
  if (b.kind === 'service' && initial_stock !== 0) {
    return {
      ok: false,
      error: 'service_with_stock',
      message: 'Serviço não controla estoque',
    };
  }

  const active = b.active === undefined ? true : Boolean(b.active);

  return {
    ok: true,
    value: {
      kind: b.kind,
      name,
      description,
      sku,
      unit_price: Math.round(unit_price * 100) / 100,
      initial_stock,
      active,
    },
  };
}

export type StockAdjustError =
  'invalid_reason' | 'invalid_qty' | 'empty_note' | 'not_product';

export interface StockAdjustInput {
  reason: 'adjustment_in' | 'adjustment_out' | 'correction';
  /** Inteiro sempre positivo na entrada; o sinal é derivado do reason. */
  qty: number;
  note: string | null;
}

/**
 * Converte ajuste em delta assinado para o ledger.
 * adjustment_in → +qty; adjustment_out → −qty; correction → +qty
 * (correction com qty negativo no body é aceito via signed_qty opcional).
 */
export function validateStockAdjustment(
  body: unknown,
  itemKind: CatalogItemKind
):
  | { ok: true; value: StockAdjustInput; signed_qty: number }
  | { ok: false; error: StockAdjustError; message: string } {
  if (itemKind !== 'product') {
    return {
      ok: false,
      error: 'not_product',
      message: 'Estoque só é permitido para produtos',
    };
  }
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_reason', message: 'Body inválido' };
  }
  const b = body as Record<string, unknown>;
  const reason = b.reason;
  if (
    typeof reason !== 'string' ||
    !ADJUST_REASONS.has(reason as StockMovementReason)
  ) {
    return {
      ok: false,
      error: 'invalid_reason',
      message: 'Motivo de ajuste inválido',
    };
  }

  const qtyRaw =
    typeof b.qty === 'number'
      ? b.qty
      : typeof b.qty === 'string'
        ? Number(b.qty)
        : NaN;
  // Estoque é contagem de unidades: nada de saldo quebrado.
  if (!Number.isInteger(qtyRaw) || qtyRaw === 0) {
    return {
      ok: false,
      error: 'invalid_qty',
      message: 'Quantidade deve ser um número inteiro diferente de zero',
    };
  }

  let signed_qty: number;
  if (reason === 'adjustment_in') {
    if (qtyRaw < 0) {
      return {
        ok: false,
        error: 'invalid_qty',
        message: 'Entrada exige quantidade positiva',
      };
    }
    signed_qty = qtyRaw;
  } else if (reason === 'adjustment_out') {
    if (qtyRaw < 0) {
      return {
        ok: false,
        error: 'invalid_qty',
        message: 'Saída exige quantidade positiva',
      };
    }
    signed_qty = -qtyRaw;
  } else {
    // correction: qty já pode vir com sinal (positivo ou negativo)
    signed_qty = qtyRaw;
  }

  let note: string | null = null;
  if (typeof b.note === 'string') {
    note = b.note.trim() || null;
  }

  return {
    ok: true,
    value: {
      reason: reason as StockAdjustInput['reason'],
      qty: Math.abs(qtyRaw),
      note,
    },
    signed_qty,
  };
}

export type CatalogPatchInput = {
  name?: string;
  description?: string | null;
  sku?: string | null;
  unit_price?: number;
  active?: boolean;
};

export function validateCatalogPatch(
  body: unknown
):
  | { ok: true; value: CatalogPatchInput }
  | { ok: false; error: CatalogValidateError; message: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'invalid_kind', message: 'Body inválido' };
  }
  const b = body as Record<string, unknown>;
  const patch: CatalogPatchInput = {};

  if ('name' in b) {
    if (typeof b.name !== 'string' || b.name.trim().length === 0) {
      return { ok: false, error: 'empty_name', message: 'Nome é obrigatório' };
    }
    const name = b.name.trim();
    if (name.length > CATALOG_NAME_MAX) {
      return { ok: false, error: 'name_too_long', message: 'Nome muito longo' };
    }
    patch.name = name;
  }

  if ('description' in b) {
    if (b.description === null) {
      patch.description = null;
    } else if (typeof b.description === 'string') {
      const description = b.description.trim() || null;
      if (description && description.length > CATALOG_DESC_MAX) {
        return {
          ok: false,
          error: 'desc_too_long',
          message: 'Descrição muito longa',
        };
      }
      patch.description = description;
    } else {
      return {
        ok: false,
        error: 'desc_too_long',
        message: 'Descrição inválida',
      };
    }
  }

  if ('sku' in b) {
    const sku = normalizeSku(b.sku);
    if (sku && sku.length > CATALOG_SKU_MAX) {
      return { ok: false, error: 'sku_too_long', message: 'SKU muito longo' };
    }
    patch.sku = sku;
  }

  if ('unit_price' in b) {
    const unit_price =
      typeof b.unit_price === 'number'
        ? b.unit_price
        : typeof b.unit_price === 'string'
          ? Number(b.unit_price)
          : NaN;
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      return {
        ok: false,
        error: 'invalid_price',
        message: 'Preço inválido',
      };
    }
    patch.unit_price = Math.round(unit_price * 100) / 100;
  }

  if ('active' in b) {
    patch.active = Boolean(b.active);
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'invalid_kind', message: 'Nada para atualizar' };
  }

  return { ok: true, value: patch };
}
