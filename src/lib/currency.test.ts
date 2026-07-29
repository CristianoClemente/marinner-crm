import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  formatCurrency,
  formatCurrencyShort,
} from "./currency";

describe("formatCurrency", () => {
  it("formata inteiros sem centavos forçados", () => {
    const out = formatCurrency(1234, "BRL");
    expect(out).toContain("1.234");
    expect(out).not.toContain(",00");
  });

  it("mostra centavos quando o valor tem fração", () => {
    const out = formatCurrency(1234.5, "BRL");
    expect(out).toMatch(/1\.234,5/);
  });

  it("usa BRL como padrão quando nenhuma moeda é passada", () => {
    expect(formatCurrency(10)).toBe(formatCurrency(10, DEFAULT_CURRENCY));
    expect(DEFAULT_CURRENCY).toBe("BRL");
  });

  it("trata string vazia como o padrão", () => {
    expect(formatCurrency(10, "")).toBe(formatCurrency(10, DEFAULT_CURRENCY));
  });

  it("coerce valores não finitos para 0", () => {
    expect(formatCurrency(Number.NaN, "BRL")).toContain("0");
  });

  it("ainda formata moeda legada (USD) sem lançar", () => {
    const out = formatCurrency(1234, "USD");
    expect(out).toContain("1.234");
  });

  it("nunca lança em código estruturalmente inválido", () => {
    for (const bad of ["United States", "US", "USDD", "12", "u$d"]) {
      expect(() => formatCurrency(1234, bad)).not.toThrow();
      expect(formatCurrency(1234, bad)).toContain("1.234");
    }
  });

  it("formata toda moeda oferecida sem lançar", () => {
    expect(CURRENCIES).toHaveLength(1);
    expect(CURRENCIES[0]?.code).toBe("BRL");
    for (const c of CURRENCIES) {
      expect(() => formatCurrency(1000, c.code)).not.toThrow();
    }
  });
});

describe("formatCurrencyShort", () => {
  it("abrevia milhões e milhares com o símbolo do Real", () => {
    expect(formatCurrencyShort(2_500_000, "BRL")).toBe("R$2.5M");
    expect(formatCurrencyShort(3_400, "BRL")).toBe("R$3.4k");
    expect(formatCurrencyShort(900, "BRL")).toBe("R$900");
  });

  it("usa símbolo Intl para moeda legada fora da lista", () => {
    const out = formatCurrencyShort(1_000, "USD");
    expect(out.endsWith("1.0k")).toBe(true);
  });

  it("cai no prefixo do código para moeda desconhecida", () => {
    expect(formatCurrencyShort(1_000, "ZZZ")).toBe("ZZZ1.0k");
  });
});
