import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  formatDate,
  formatDateTime,
  formatNumber,
} from "./format";

describe("format", () => {
  it("exporta pt-BR como locale padrão", () => {
    expect(DEFAULT_LOCALE).toBe("pt-BR");
  });

  it("formatNumber agrupa milhares no padrão BR", () => {
    expect(formatNumber(1234)).toBe("1.234");
  });

  it("formatDate formata data em pt-BR", () => {
    // Meio-dia UTC evita virar o dia anterior em fusos negativos.
    expect(formatDate("2024-01-15T12:00:00.000Z")).toMatch(/15/);
  });

  it("formatDateTime inclui componentes de data/hora", () => {
    const out = formatDateTime("2024-01-15T15:30:00.000Z");
    expect(out.length).toBeGreaterThan(8);
  });
});
