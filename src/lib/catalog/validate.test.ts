import { describe, expect, it } from 'vitest';
import {
  normalizeSku,
  validateCatalogCreate,
  validateStockAdjustment,
} from './validate';

describe('normalizeSku', () => {
  it('trim e upper-case', () => {
    expect(normalizeSku('  abc-1  ')).toBe('ABC-1');
  });
  it('vazio vira null', () => {
    expect(normalizeSku('   ')).toBeNull();
  });
});

describe('validateCatalogCreate', () => {
  it('aceita serviço sem estoque', () => {
    const r = validateCatalogCreate({
      kind: 'service',
      name: 'Curso Arrais',
      unit_price: 1200,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.initial_stock).toBe(0);
      expect(r.value.kind).toBe('service');
    }
  });

  it('aceita produto com estoque inicial', () => {
    const r = validateCatalogCreate({
      kind: 'product',
      name: 'Colete',
      unit_price: '89.9',
      initial_stock: 10,
      sku: 'col-01',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sku).toBe('COL-01');
      expect(r.value.unit_price).toBe(89.9);
      expect(r.value.initial_stock).toBe(10);
    }
  });

  it('rejeita nome vazio', () => {
    const r = validateCatalogCreate({
      kind: 'product',
      name: '  ',
      unit_price: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('empty_name');
  });

  it('rejeita estoque inicial fracionado', () => {
    const r = validateCatalogCreate({
      kind: 'product',
      name: 'Colete',
      unit_price: 10,
      initial_stock: 2.5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_stock');
  });
});

describe('validateStockAdjustment', () => {
  it('rejeita serviço', () => {
    const r = validateStockAdjustment(
      { reason: 'adjustment_in', qty: 1 },
      'service'
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('not_product');
  });

  it('entrada positiva', () => {
    const r = validateStockAdjustment(
      { reason: 'adjustment_in', qty: 5, note: 'compra' },
      'product'
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.signed_qty).toBe(5);
  });

  it('saída vira negativo', () => {
    const r = validateStockAdjustment(
      { reason: 'adjustment_out', qty: 2 },
      'product'
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.signed_qty).toBe(-2);
  });

  it('rejeita quantidade fracionada', () => {
    const r = validateStockAdjustment(
      { reason: 'adjustment_in', qty: 1.5 },
      'product'
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('invalid_qty');
  });

  it('aceita correção negativa inteira', () => {
    const r = validateStockAdjustment(
      { reason: 'correction', qty: -3 },
      'product'
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.signed_qty).toBe(-3);
  });
});
