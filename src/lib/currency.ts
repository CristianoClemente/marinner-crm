/**
 * Moeda — padrão do produto é BRL (pt-BR).
 *
 * Novos negócios/contas usam sempre BRL. Negócios legados com outra
 * moeda gravada continuam sendo formatados nessa moeda.
 */

import { DEFAULT_LOCALE, formatNumber } from "@/lib/format";

/** Fallback quando não há moeda de conta/negócio. */
export const DEFAULT_CURRENCY = "BRL";

export interface CurrencyOption {
  /** Código ISO-4217, ex.: "BRL". */
  code: string;
  /** Rótulo para exibição, ex.: "Real". */
  label: string;
  /** Símbolo compacto, ex.: "R$". */
  symbol: string;
}

/**
 * Moedas oferecidas na UI. O produto trava em BRL — a lista existe
 * só para label/símbolo. Histórico com outros códigos ainda formata
 * via Intl sem precisar estar aqui.
 */
export const CURRENCIES: CurrencyOption[] = [
  { code: "BRL", label: "Real", symbol: "R$" },
];

function currencySymbol(code: string): string {
  const known = CURRENCIES.find((c) => c.code === code)?.symbol;
  if (known) return known;
  try {
    const part = new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency: code,
      currencyDisplay: "narrowSymbol",
    })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? `${code} `;
  } catch {
    return `${code} `;
  }
}

/**
 * Formata valor monetário. Híbrido: inteiros sem centavos
 * (`R$ 1.234`); com fração mostra até 2 casas (`R$ 1.234,56`).
 * `currency` legado (USD etc.) ainda é respeitado na formatação.
 */
export function formatCurrency(
  value: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const code = (currency || DEFAULT_CURRENCY).trim();
  const amount = Number(value) || 0;
  try {
    return new Intl.NumberFormat(DEFAULT_LOCALE, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${formatNumber(amount, { maximumFractionDigits: 0 })}`;
  }
}

/**
 * Moeda compacta para espaços apertados: `R$1.2M` / `R$3.4k`.
 */
export function formatCurrencyShort(
  value: number,
  currency: string = DEFAULT_CURRENCY,
): string {
  const code = currency || DEFAULT_CURRENCY;
  const symbol = currencySymbol(code);
  return `${symbol}${formatCompactNumber(value)}`;
}

/**
 * Número compacto: 1_234 → "1.2k", 1_200_000 → "1.2M".
 */
export function formatCompactNumber(value: number): string {
  const v = Number(value || 0);
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}
