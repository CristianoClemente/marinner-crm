import { describe, expect, it } from "vitest";
import { normalizeSlug, validateSlug } from "./slug";

describe("normalizeSlug", () => {
  it("lower-case e espaços viram hífen", () => {
    expect(normalizeSlug("  Escola Nautica  ")).toBe("escola-nautica");
  });

  it("remove acentos/símbolos e colapsa hífens", () => {
    expect(normalizeSlug("Escola—Náutica!!")).toBe("escolanutica");
    expect(normalizeSlug("a---b")).toBe("a-b");
  });
});

describe("validateSlug", () => {
  it("aceita slug válido", () => {
    expect(validateSlug("escola-nautica")).toEqual({
      ok: true,
      slug: "escola-nautica",
    });
  });

  it("rejeita vazio", () => {
    expect(validateSlug("   ").error).toBe("empty");
  });

  it("rejeita curto demais", () => {
    expect(validateSlug("ab").error).toBe("too_short");
  });

  it("rejeita reservados", () => {
    expect(validateSlug("app").error).toBe("reserved");
    expect(validateSlug("www").error).toBe("reserved");
    expect(validateSlug("admin").error).toBe("reserved");
  });

  it("rejeita hífen nas pontas após normalizar", () => {
    // normalize remove hífens das pontas; "--ab" → "ab" → too_short
    expect(validateSlug("--ab").error).toBe("too_short");
  });

  it("normaliza antes de validar", () => {
    expect(validateSlug("Escola Nautica").slug).toBe("escola-nautica");
    expect(validateSlug("Escola Nautica").ok).toBe(true);
  });
});
