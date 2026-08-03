import { describe, expect, it } from "vitest";
import { digitsOnly, isValidCpfCnpj } from "./cpf-cnpj";

describe("cpf-cnpj", () => {
  it("aceita CPF e CNPJ válidos", () => {
    expect(isValidCpfCnpj("529.982.247-25")).toBe(true);
    expect(isValidCpfCnpj("04.252.011/0001-10")).toBe(true);
  });

  it("rejeita inválidos", () => {
    expect(isValidCpfCnpj("111.111.111-11")).toBe(false);
    expect(isValidCpfCnpj("123")).toBe(false);
    expect(digitsOnly("a1b2")).toBe("12");
  });
});
