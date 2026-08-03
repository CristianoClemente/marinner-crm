import type {
  ContactDocumentFields,
  InstructorDocumentFields,
  LocationDocumentFields,
} from "@/lib/documents/types";

export type ValidationResult =
  | { ok: true }
  | { ok: false; gaps: string[] };

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateResidenceContact(
  contact: ContactDocumentFields,
): ValidationResult {
  const gaps: string[] = [];
  if (!nonEmpty(contact.name)) gaps.push("Nome do contato");
  if (!nonEmpty(contact.cpf)) gaps.push("CPF");
  if (!nonEmpty(contact.endereco)) gaps.push("Endereço (logradouro)");
  if (!nonEmpty(contact.cidade)) gaps.push("Cidade");
  if (!nonEmpty(contact.estado)) gaps.push("UF");
  if (gaps.length > 0) return { ok: false, gaps };
  return { ok: true };
}

export function validateAtestadoContext(input: {
  contact: ContactDocumentFields;
  instructor: InstructorDocumentFields | null;
  location: LocationDocumentFields | null;
}): ValidationResult {
  const gaps: string[] = [];
  if (!nonEmpty(input.contact.name)) gaps.push("Nome do aluno");
  if (!nonEmpty(input.contact.cpf)) gaps.push("CPF do aluno");
  if (!input.instructor) {
    gaps.push("Instrutor da turma");
  } else {
    if (!nonEmpty(input.instructor.full_name)) gaps.push("Nome do instrutor");
    if (!nonEmpty(input.instructor.cha_number)) gaps.push("CHA do instrutor");
  }
  if (!input.location) {
    gaps.push("Local da aula");
  } else if (!nonEmpty(input.location.name)) {
    gaps.push("Nome do local");
  }
  if (gaps.length > 0) return { ok: false, gaps };
  return { ok: true };
}

export function formatContactAddress(contact: ContactDocumentFields): string {
  const parts = [
    contact.endereco,
    contact.numero ? `nº ${contact.numero}` : null,
    contact.complemento,
    contact.bairro,
    contact.cidade && contact.estado
      ? `${contact.cidade}/${contact.estado}`
      : contact.cidade || contact.estado,
    contact.cep ? `CEP ${contact.cep}` : null,
  ].filter((p): p is string => Boolean(p && String(p).trim()));
  return parts.join(", ");
}
