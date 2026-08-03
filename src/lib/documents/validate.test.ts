import { describe, expect, it } from "vitest";
import {
  atestadoKindFor,
  resolveHabilitationKind,
} from "@/lib/documents/resolve-kind";
import {
  formatContactAddress,
  validateAtestadoContext,
  validateResidenceContact,
} from "@/lib/documents/validate";
import type { ContactDocumentFields } from "@/lib/documents/types";

const baseContact: ContactDocumentFields = {
  id: "c1",
  name: "Ana Silva",
  cpf: "12345678901",
  phone: null,
  endereco: "Rua das Flores",
  numero: "10",
  bairro: "Centro",
  cidade: "Santos",
  estado: "SP",
  complemento: null,
  cep: "11000-000",
};

describe("resolveHabilitationKind", () => {
  it("usa coluna explícita", () => {
    expect(
      resolveHabilitationKind({
        habilitation_kind: "motonauta",
        name: "Arrais",
      }),
    ).toBe("motonauta");
  });

  it("infere pelo nome", () => {
    expect(resolveHabilitationKind({ name: "Arrais-Amador" })).toBe("arrais");
    expect(resolveHabilitationKind({ name: "Curso Motonauta" })).toBe(
      "motonauta",
    );
  });

  it("retorna null se ambíguo", () => {
    expect(resolveHabilitationKind({ name: "Funil genérico" })).toBeNull();
  });

  it("mapeia kind de atestado", () => {
    expect(atestadoKindFor("arrais")).toBe("atestado_arrais");
    expect(atestadoKindFor("motonauta")).toBe("atestado_motonauta");
  });
});

describe("validateResidenceContact", () => {
  it("aceita contato completo", () => {
    expect(validateResidenceContact(baseContact)).toEqual({ ok: true });
  });

  it("lista gaps", () => {
    const r = validateResidenceContact({
      ...baseContact,
      cpf: null,
      cidade: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.gaps).toContain("CPF");
      expect(r.gaps).toContain("Cidade");
    }
  });
});

describe("validateAtestadoContext", () => {
  it("exige instrutor e local", () => {
    const r = validateAtestadoContext({
      contact: baseContact,
      instructor: null,
      location: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.gaps).toContain("Instrutor da turma");
      expect(r.gaps).toContain("Local da aula");
    }
  });

  it("passa com contexto completo", () => {
    const r = validateAtestadoContext({
      contact: baseContact,
      instructor: {
        id: "i1",
        full_name: "João",
        cha_number: "123",
        cha_category: "ara",
      },
      location: { id: "l1", name: "Marina X", endereco: "Av. 1" },
    });
    expect(r).toEqual({ ok: true });
  });
});

describe("formatContactAddress", () => {
  it("monta endereço legível", () => {
    expect(formatContactAddress(baseContact)).toContain("Santos/SP");
  });
});
