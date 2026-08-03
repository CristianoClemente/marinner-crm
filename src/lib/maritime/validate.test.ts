import { describe, expect, it } from "vitest";
import {
  canAddJurisdiction,
  effectiveJurisdictionEmail,
  validateJurisdictionCreate,
  validateJurisdictionPatch,
} from "./validate";

describe("effectiveJurisdictionEmail", () => {
  it("prefere override", () => {
    expect(
      effectiveJurisdictionEmail(" a@b.com ", "secom@cp.mil.br"),
    ).toBe("a@b.com");
  });
  it("cai no catálogo", () => {
    expect(effectiveJurisdictionEmail(null, "secom@cp.mil.br")).toBe(
      "secom@cp.mil.br",
    );
  });
  it("retorna null se ambos vazios", () => {
    expect(effectiveJurisdictionEmail("  ", null)).toBeNull();
  });
});

describe("canAddJurisdiction", () => {
  it("ilimitado quando max é null", () => {
    expect(canAddJurisdiction(100, null)).toBe(true);
  });
  it("respeita teto", () => {
    expect(canAddJurisdiction(0, 1)).toBe(true);
    expect(canAddJurisdiction(1, 1)).toBe(false);
    expect(canAddJurisdiction(2, 3)).toBe(true);
  });
});

describe("validateJurisdictionCreate", () => {
  it("aceita payload válido", () => {
    const r = validateJurisdictionCreate({
      authority_id: 66,
      responsible_user_id: "11111111-1111-4111-8111-111111111111",
      email_override: "x@y.com",
      is_default: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.authority_id).toBe(66);
      expect(r.value.is_default).toBe(true);
    }
  });

  it("rejeita authority inválida", () => {
    const r = validateJurisdictionCreate({
      authority_id: 0,
      responsible_user_id: "11111111-1111-4111-8111-111111111111",
    });
    expect(r.ok).toBe(false);
  });
});

describe("validateJurisdictionPatch", () => {
  it("exige ao menos um campo", () => {
    const r = validateJurisdictionPatch({});
    expect(r.ok).toBe(false);
  });

  it("aceita is_default", () => {
    const r = validateJurisdictionPatch({ is_default: false });
    expect(r.ok).toBe(true);
  });
});
