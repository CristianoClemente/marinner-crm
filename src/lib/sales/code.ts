/**
 * Formatação do código de cupom da venda.
 * Persistido sem padding (`"42"`); a UI mostra `#000042`.
 */

export function formatSaleCode(code: string | number): string {
  const raw = String(code).trim();
  if (!/^\d+$/.test(raw)) return raw;
  return raw.length >= 6 ? raw : raw.padStart(6, "0");
}
