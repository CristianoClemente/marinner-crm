import type { EnrollmentProcess } from "@/lib/processes/types";

/**
 * Rótulo do aluno no processo: nome, telefone ou CPF, nessa ordem.
 * O `fallback` vem da UI (i18n) para o contato sem nenhum identificador.
 */
export function processContactLabel(
  process: EnrollmentProcess,
  fallback: string,
): string {
  const contact = process.contact;
  if (!contact) return fallback;
  return (
    contact.name?.trim() ||
    contact.phone?.trim() ||
    contact.cpf?.trim() ||
    fallback
  );
}

/** Linha secundária do card: telefone e CPF quando existirem. */
export function processContactMeta(process: EnrollmentProcess): string {
  const contact = process.contact;
  if (!contact) return "";
  const parts: string[] = [];
  if (contact.name?.trim() && contact.phone?.trim()) parts.push(contact.phone.trim());
  if (contact.cpf?.trim()) parts.push(`CPF ${contact.cpf.trim()}`);
  return parts.join(" · ");
}
