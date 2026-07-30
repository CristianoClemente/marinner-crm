import { describe, expect, it } from "vitest";
import { formatSaleCode } from "./code";

describe("formatSaleCode", () => {
  it("zero-pad até 6 dígitos", () => {
    expect(formatSaleCode("1")).toBe("000001");
    expect(formatSaleCode(42)).toBe("000042");
  });

  it("não trunca acima de 6 dígitos", () => {
    expect(formatSaleCode("1000000")).toBe("1000000");
  });
});
