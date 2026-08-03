import { describe, expect, it } from "vitest";
import { renderDocumentHtml } from "@/lib/documents/render-html";
import type {
  AtestadoPayload,
  ResidenciaPayload,
  RequerimentoPayload,
} from "@/lib/documents/types";

const contact = {
  id: "c1",
  name: "Ana Silva",
  cpf: "123.456.789-00",
  phone: "13999990000",
  email: "ana@example.com",
  endereco: "Rua A",
  numero: "1",
  bairro: "Centro",
  cidade: "Santos",
  estado: "SP",
  complemento: null,
  cep: "11000-000",
  doc_numero: "MG-11",
  doc_orgao_emissor: "SSP",
};

const atestadoBase = {
  contact,
  instructor: {
    id: "i1",
    full_name: "João Instrutor",
    cha_number: "CHA-1",
    cha_category: "ara",
  },
  location: { id: "l1", name: "Marina Centro", endereco: "Av. Beira Mar" },
  school: {
    name: "Escola Náutica Exemplo",
    responsibleName: "Maria Responsável",
    authoritySigla: "CPSP",
    authorityNome: "Capitania dos Portos de São Paulo",
  },
  classStartsAt: "03/08/2026 09:00",
  trainingHoursLabel: "6 horas",
} as const;

describe("renderDocumentHtml", () => {
  it("atestado arrais contém anexo 5-E", () => {
    const payload: AtestadoPayload = {
      kind: "atestado_arrais",
      ...atestadoBase,
    };
    const html = renderDocumentHtml(payload);
    expect(html).toContain("ANEXO 5-E");
    expect(html).toContain("ARRAIS-AMADOR");
    expect(html).toContain("Ana Silva");
  });

  it("atestado motonauta contém anexo 3-B", () => {
    const payload: AtestadoPayload = {
      kind: "atestado_motonauta",
      ...atestadoBase,
    };
    expect(renderDocumentHtml(payload)).toContain("ANEXO 3-B");
  });

  it("residência e requerimento", () => {
    const res: ResidenciaPayload = {
      kind: "declaracao_residencia",
      contact,
      issuedAt: "03/08/2026",
      cityForSignature: "Santos",
    };
    expect(renderDocumentHtml(res)).toContain("DECLARAÇÃO DE RESIDÊNCIA");

    const req: RequerimentoPayload = {
      kind: "requerimento_capitania",
      variant: "arrais",
      contact,
      serviceOption: "EMISSÃO/RENOVAÇÃO",
      serviceDescription: "",
      issuedAt: "03/08/2026",
      cityForSignature: "Santos",
    };
    expect(renderDocumentHtml(req)).toContain("ANEXO 5-H");
  });
});
