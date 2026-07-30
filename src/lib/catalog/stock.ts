/**
 * Regras puras de saldo de estoque (espelha o trigger SQL).
 */

export type ApplyMovementResult =
  { ok: true; next: number } | { ok: false; error: 'insufficient_stock' };

export function applyMovementToQty(
  current: number,
  qtyDelta: number
): ApplyMovementResult {
  const next = current + qtyDelta;
  if (next < 0) {
    return { ok: false, error: 'insufficient_stock' };
  }
  return { ok: true, next };
}

/**
 * Texto de campo de estoque reduzido à parte inteira — estoque conta unidades,
 * então o que vem depois do separador decimal é descartado em vez de arredondar.
 * Retorna string (e não número) para o campo continuar controlado enquanto o
 * operador digita: `""` e `"-"` são estados válidos de digitação.
 */
export function toIntegerText(
  raw: string,
  options?: { allowNegative?: boolean }
): string {
  const negative = !!options?.allowNegative && raw.trimStart().startsWith('-');
  const digits = raw.replace(/[.,].*$/, '').replace(/\D/g, '');
  if (!negative) return digits;
  return digits ? `-${digits}` : '-';
}
