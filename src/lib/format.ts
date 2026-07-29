/**
 * Formatação de datas e números — locale único do produto (pt-BR).
 *
 * Use estes helpers em vez de `toLocaleString('pt-BR')` solto.
 * Moeda fica em `@/lib/currency` (que importa `DEFAULT_LOCALE` daqui).
 */

export const DEFAULT_LOCALE = "pt-BR";

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Data curta no padrão brasileiro (ex.: 15/01/2024). */
export function formatDate(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleDateString(DEFAULT_LOCALE, options);
}

/** Data + hora no padrão brasileiro. */
export function formatDateTime(
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return toDate(value).toLocaleString(DEFAULT_LOCALE, options);
}

/** Número agrupado no padrão brasileiro (ex.: 1.234). */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(
    Number(value) || 0,
  );
}
