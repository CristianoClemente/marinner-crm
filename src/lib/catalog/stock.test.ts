import { describe, expect, it } from 'vitest';
import { applyMovementToQty, toIntegerText } from './stock';

describe('applyMovementToQty', () => {
  it('soma entrada', () => {
    expect(applyMovementToQty(10, 3)).toEqual({ ok: true, next: 13 });
  });

  it('baixa estoque', () => {
    expect(applyMovementToQty(10, -4)).toEqual({ ok: true, next: 6 });
  });

  it('rejeita saldo negativo', () => {
    expect(applyMovementToQty(2, -3)).toEqual({
      ok: false,
      error: 'insufficient_stock',
    });
  });
});

describe('toIntegerText', () => {
  it('descarta a parte decimal em vez de arredondar', () => {
    expect(toIntegerText('2,9')).toBe('2');
    expect(toIntegerText('2.9')).toBe('2');
  });

  it('remove qualquer caractere não numérico', () => {
    expect(toIntegerText('1a2')).toBe('12');
    expect(toIntegerText('-5')).toBe('5');
  });

  it('preserva o sinal quando negativo é permitido', () => {
    expect(toIntegerText('-5', { allowNegative: true })).toBe('-5');
    expect(toIntegerText('-', { allowNegative: true })).toBe('-');
  });

  it('mantém campo vazio como vazio', () => {
    expect(toIntegerText('')).toBe('');
  });
});
