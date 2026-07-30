import { describe, expect, it } from 'vitest';
import { prepareSale } from './confirm';
import type { CatalogItem } from '@/types';

function item(
  partial: Partial<CatalogItem> & Pick<CatalogItem, 'id' | 'kind' | 'name'>
): CatalogItem {
  return {
    account_id: 'acc',
    unit_price: 10,
    stock_qty: 0,
    active: true,
    created_at: '',
    updated_at: '',
    description: null,
    sku: null,
    ...partial,
  };
}

describe('prepareSale', () => {
  it('venda mista baixa só produto', () => {
    const product = item({
      id: 'p1',
      kind: 'product',
      name: 'Colete',
      stock_qty: 5,
      unit_price: 100,
    });
    const service = item({
      id: 's1',
      kind: 'service',
      name: 'Curso',
      unit_price: 500,
    });
    const map = new Map([
      [product.id, product],
      [service.id, service],
    ]);

    const r = prepareSale({
      payment_method: 'pix',
      lines: [
        { catalog_item_id: 'p1', qty: 2, unit_price: 90 },
        { catalog_item_id: 's1', qty: 1, unit_price: 500 },
      ],
      itemsById: map,
    });

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.subtotal).toBe(680);
    expect(r.discount_amount).toBe(0);
    expect(r.total).toBe(680);
    expect(r.stockDeltas).toEqual([{ catalog_item_id: 'p1', qty: -2 }]);
    expect(r.items).toHaveLength(2);
  });

  it('aplica desconto percentual', () => {
    const service = item({
      id: 's1',
      kind: 'service',
      name: 'Curso',
      unit_price: 100,
    });
    const r = prepareSale({
      payment_method: 'pix',
      discount_type: 'percent',
      discount_value: 10,
      lines: [{ catalog_item_id: 's1', qty: 1, unit_price: 100 }],
      itemsById: new Map([[service.id, service]]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.subtotal).toBe(100);
    expect(r.discount_amount).toBe(10);
    expect(r.total).toBe(90);
  });

  it('percentual 100 zera o total', () => {
    const service = item({
      id: 's1',
      kind: 'service',
      name: 'Curso',
      unit_price: 50,
    });
    const r = prepareSale({
      payment_method: 'cash',
      discount_type: 'percent',
      discount_value: 100,
      lines: [{ catalog_item_id: 's1', qty: 1, unit_price: 50 }],
      itemsById: new Map([[service.id, service]]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.total).toBe(0);
  });

  it('desconto fixo não passa do subtotal', () => {
    const service = item({
      id: 's1',
      kind: 'service',
      name: 'Curso',
      unit_price: 40,
    });
    const r = prepareSale({
      payment_method: 'pix',
      discount_type: 'fixed',
      discount_value: 100,
      lines: [{ catalog_item_id: 's1', qty: 1, unit_price: 40 }],
      itemsById: new Map([[service.id, service]]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.discount_amount).toBe(40);
    expect(r.total).toBe(0);
  });

  it('rejeita percentual acima de 100', () => {
    const service = item({
      id: 's1',
      kind: 'service',
      name: 'Curso',
      unit_price: 10,
    });
    const r = prepareSale({
      payment_method: 'pix',
      discount_type: 'percent',
      discount_value: 101,
      lines: [{ catalog_item_id: 's1', qty: 1, unit_price: 10 }],
      itemsById: new Map([[service.id, service]]),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_discount');
  });

  it('rejeita estoque insuficiente', () => {
    const product = item({
      id: 'p1',
      kind: 'product',
      name: 'Colete',
      stock_qty: 1,
    });
    const r = prepareSale({
      payment_method: 'cash',
      lines: [{ catalog_item_id: 'p1', qty: 2, unit_price: 10 }],
      itemsById: new Map([[product.id, product]]),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('insufficient_stock');
  });

  it('rejeita quantidade fracionada de produto', () => {
    const product = item({
      id: 'p1',
      kind: 'product',
      name: 'Colete',
      stock_qty: 9,
    });
    const r = prepareSale({
      payment_method: 'pix',
      lines: [{ catalog_item_id: 'p1', qty: 1.5, unit_price: 10 }],
      itemsById: new Map([[product.id, product]]),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_qty');
  });

  it('rejeita item inativo', () => {
    const product = item({
      id: 'p1',
      kind: 'product',
      name: 'X',
      active: false,
      stock_qty: 9,
    });
    const r = prepareSale({
      payment_method: 'card',
      lines: [{ catalog_item_id: 'p1', qty: 1, unit_price: 10 }],
      itemsById: new Map([[product.id, product]]),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('item_inactive');
  });
});
