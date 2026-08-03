import { describe, expect, it } from "vitest";
import { resolveResponsibleForLocation } from "./resolve-responsible";

const link = {
  authority_id: 66,
  responsible_user_id: "u1",
  responsible_full_name: "Maria Silva",
  email_override: null as string | null,
  catalog_email: "secom@cpsp.mar.mil.br",
  authority_sigla: "CPSP",
  authority_nome: "Capitania dos Portos de São Paulo",
};

describe("resolveResponsibleForLocation", () => {
  it("resolve via authority do local", () => {
    const r = resolveResponsibleForLocation({
      authorityId: 66,
      links: [link],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.responsibleName).toBe("Maria Silva");
      expect(r.effectiveEmail).toBe("secom@cpsp.mar.mil.br");
    }
  });

  it("falha sem authority no local", () => {
    const r = resolveResponsibleForLocation({
      authorityId: null,
      links: [link],
    });
    expect(r).toEqual({
      ok: false,
      gap: "missing_authority_on_location",
    });
  });

  it("falha se OM não vinculada", () => {
    const r = resolveResponsibleForLocation({
      authorityId: 44,
      links: [link],
    });
    expect(r).toEqual({ ok: false, gap: "jurisdiction_not_linked" });
  });
});
