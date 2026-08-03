/**
 * Documentos de habilitação (NORMAM) — tipos e constantes.
 * Spec: docs/superpowers/specs/2026-08-03-habilitation-documents-design.md
 */

export const DOCUMENT_KINDS = [
  "atestado_arrais",
  "atestado_motonauta",
  "declaracao_residencia",
  "requerimento_capitania",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

export type HabilitationKind = "arrais" | "motonauta";

/** Bump quando o HTML do anexo mudar de forma material. */
export const DOCUMENT_TEMPLATE_VERSION = "2026-08-03.1";

export type ContactDocumentFields = {
  id: string;
  name: string | null;
  cpf: string | null;
  phone: string | null;
  email?: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  complemento: string | null;
  cep: string | null;
  doc_numero?: string | null;
  doc_orgao_emissor?: string | null;
};

export type InstructorDocumentFields = {
  id: string;
  full_name: string;
  cha_number: string;
  cha_category: string;
  phone?: string | null;
};

export type LocationDocumentFields = {
  id: string;
  name: string;
  endereco: string | null;
};

export type SchoolDocumentFields = {
  name: string;
  responsibleName?: string;
  authoritySigla?: string;
  authorityNome?: string;
};

export type AtestadoPayload = {
  kind: "atestado_arrais" | "atestado_motonauta";
  contact: ContactDocumentFields;
  instructor: InstructorDocumentFields;
  location: LocationDocumentFields;
  school: SchoolDocumentFields;
  classStartsAt: string;
  /** Horas totais declaradas no atestado (Arrais mín. 6; Motonauta usa plano em min). */
  trainingHoursLabel: string;
  theoreticalMinutes?: number;
  practicalMinutes?: number;
};

export type ResidenciaPayload = {
  kind: "declaracao_residencia";
  contact: ContactDocumentFields;
  issuedAt: string;
  cityForSignature: string;
};

export type RequerimentoServiceOption =
  | "emissao_renovacao_2via"
  | "agregacao_mta"
  | "outro";

export type RequerimentoPayload = {
  kind: "requerimento_capitania";
  variant: HabilitationKind;
  contact: ContactDocumentFields;
  serviceOption: string;
  serviceDescription: string;
  issuedAt: string;
  cityForSignature: string;
};

export type DocumentPayload =
  | AtestadoPayload
  | ResidenciaPayload
  | RequerimentoPayload;

export type GeneratedDocumentRow = {
  id: string;
  account_id: string;
  kind: DocumentKind;
  template_version: string;
  contact_id: string;
  process_id: string | null;
  class_id: string | null;
  enrollment_id: string | null;
  storage_path: string;
  file_name: string;
  payload: DocumentPayload;
  created_by_user_id: string | null;
  created_at: string;
};
