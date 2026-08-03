import type { SupabaseClient } from "@supabase/supabase-js";

import { formatDate, formatDateTime } from "@/lib/format";
import {
  atestadoKindFor,
  resolveHabilitationKind,
} from "@/lib/documents/resolve-kind";
import { renderDocumentHtml } from "@/lib/documents/render-html";
import { renderHtmlToPdf } from "@/lib/documents/render-pdf";
import {
  DOCUMENT_TEMPLATE_VERSION,
  type ContactDocumentFields,
  type DocumentKind,
  type DocumentPayload,
  type GeneratedDocumentRow,
  type HabilitationKind,
} from "@/lib/documents/types";
import {
  validateAtestadoContext,
  validateResidenceContact,
} from "@/lib/documents/validate";
import { resolveResponsibleForLocation } from "@/lib/maritime/resolve-responsible";
import {
  buildGeneratedDocumentKey,
  resolveR2Target,
} from "@/lib/storage/bucket-map";
import { putR2Object } from "@/lib/storage/r2";

export type GenerateResult =
  | { ok: true; document: GeneratedDocumentRow }
  | { ok: false; status: number; error: string; gaps?: string[] };

type Ctx = {
  supabase: SupabaseClient;
  accountId: string;
  userId: string;
  accountName: string;
};

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapContact(row: Record<string, unknown>): ContactDocumentFields {
  return {
    id: String(row.id),
    name: (row.name as string | null) ?? null,
    cpf: (row.cpf as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    endereco: (row.endereco as string | null) ?? null,
    numero: (row.numero as string | null) ?? null,
    bairro: (row.bairro as string | null) ?? null,
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    complemento: (row.complemento as string | null) ?? null,
    cep: (row.cep as string | null) ?? null,
    doc_numero: (row.doc_numero as string | null) ?? null,
    doc_orgao_emissor: (row.doc_orgao_emissor as string | null) ?? null,
  };
}

async function persistPdf(input: {
  ctx: Ctx;
  kind: DocumentKind;
  contactId: string;
  processId: string | null;
  classId: string | null;
  enrollmentId: string | null;
  payload: DocumentPayload;
  fileLabel: string;
}): Promise<GenerateResult> {
  const documentId = crypto.randomUUID();
  const html = renderDocumentHtml(input.payload);
  let pdf: Buffer;
  try {
    pdf = await renderHtmlToPdf(html);
  } catch (err) {
    console.error("[documents/generate] renderHtmlToPdf", err);
    return {
      ok: false,
      status: 500,
      error: "Falha ao gerar o PDF. Verifique o Chromium no servidor.",
    };
  }

  const key = buildGeneratedDocumentKey({
    accountId: input.ctx.accountId,
    documentId,
  });
  const target = resolveR2Target("process-docs");
  const fileName = `${input.fileLabel}-${documentId.slice(0, 8)}.pdf`;
  try {
    await putR2Object({
      bucket: target.r2Bucket,
      key,
      body: pdf,
      contentType: "application/pdf",
      publicBaseUrl: target.publicBaseUrl,
    });
  } catch (err) {
    console.error("[documents/generate] putR2Object", err);
    return { ok: false, status: 500, error: "Falha ao salvar o PDF." };
  }

  const { data, error } = await input.ctx.supabase
    .from("generated_documents")
    .insert({
      id: documentId,
      account_id: input.ctx.accountId,
      kind: input.kind,
      template_version: DOCUMENT_TEMPLATE_VERSION,
      contact_id: input.contactId,
      process_id: input.processId,
      class_id: input.classId,
      enrollment_id: input.enrollmentId,
      storage_path: key,
      file_name: fileName,
      payload: input.payload,
      created_by_user_id: input.ctx.userId,
    })
    .select("*")
    .single();

  if (error || !data) {
    console.error("[documents/generate] insert", error);
    return { ok: false, status: 500, error: "Falha ao registrar o documento." };
  }

  return { ok: true, document: data as GeneratedDocumentRow };
}

export async function generateResidencia(input: {
  ctx: Ctx;
  contactId: string;
  processId?: string | null;
}): Promise<GenerateResult> {
  const { data: contact, error } = await input.ctx.supabase
    .from("contacts")
    .select(
      "id, name, cpf, phone, email, endereco, numero, bairro, cidade, estado, complemento, cep, doc_numero, doc_orgao_emissor",
    )
    .eq("account_id", input.ctx.accountId)
    .eq("id", input.contactId)
    .maybeSingle();

  if (error || !contact) {
    return { ok: false, status: 404, error: "Contato não encontrado." };
  }

  const mapped = mapContact(contact as Record<string, unknown>);
  const validation = validateResidenceContact(mapped);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: "Dados insuficientes para a declaração de residência.",
      gaps: validation.gaps,
    };
  }

  const city = mapped.cidade?.trim() || "Brasil";
  const payload: DocumentPayload = {
    kind: "declaracao_residencia",
    contact: mapped,
    issuedAt: formatDate(new Date()),
    cityForSignature: city,
  };

  return persistPdf({
    ctx: input.ctx,
    kind: "declaracao_residencia",
    contactId: mapped.id,
    processId: input.processId ?? null,
    classId: null,
    enrollmentId: null,
    payload,
    fileLabel: "declaracao-residencia",
  });
}

export async function generateRequerimento(input: {
  ctx: Ctx;
  processId: string;
  serviceOption: string;
  serviceDescription?: string;
}): Promise<GenerateResult> {
  const { data: process, error } = await input.ctx.supabase
    .from("enrollment_processes")
    .select(
      "id, contact_id, template:process_templates(id, name, habilitation_kind), contact:contacts(id, name, cpf, phone, email, endereco, numero, bairro, cidade, estado, complemento, cep, doc_numero, doc_orgao_emissor)",
    )
    .eq("account_id", input.ctx.accountId)
    .eq("id", input.processId)
    .maybeSingle();

  if (error || !process) {
    return { ok: false, status: 404, error: "Processo não encontrado." };
  }

  const template = asSingle(
    process.template as
      | { name?: string; habilitation_kind?: string | null }
      | { name?: string; habilitation_kind?: string | null }[]
      | null,
  );
  const habilitation = resolveHabilitationKind({
    habilitation_kind: template?.habilitation_kind,
    name: template?.name,
  });
  if (!habilitation) {
    return {
      ok: false,
      status: 400,
      error:
        "Funil sem tipo de habilitação (arrais/motonauta). Defina habilitation_kind ou use um preset.",
    };
  }

  const contactRaw = asSingle(
    process.contact as Record<string, unknown> | Record<string, unknown>[] | null,
  );
  if (!contactRaw) {
    return { ok: false, status: 400, error: "Processo sem contato." };
  }
  const mapped = mapContact(contactRaw);
  const validation = validateResidenceContact(mapped);
  if (!validation.ok) {
    return {
      ok: false,
      status: 400,
      error: "Dados do contato incompletos para o requerimento.",
      gaps: validation.gaps,
    };
  }

  const option = input.serviceOption.trim();
  if (!option) {
    return { ok: false, status: 400, error: "Selecione o serviço do requerimento." };
  }

  const payload: DocumentPayload = {
    kind: "requerimento_capitania",
    variant: habilitation,
    contact: mapped,
    serviceOption: option,
    serviceDescription: (input.serviceDescription ?? "").trim(),
    issuedAt: formatDate(new Date()),
    cityForSignature: mapped.cidade?.trim() || "Brasil",
  };

  return persistPdf({
    ctx: input.ctx,
    kind: "requerimento_capitania",
    contactId: mapped.id,
    processId: input.processId,
    classId: null,
    enrollmentId: null,
    payload,
    fileLabel: "requerimento-capitania",
  });
}

export async function generateAtestadoForEnrollment(input: {
  ctx: Ctx;
  classId: string;
  enrollmentId: string;
  trainingHoursLabel?: string;
  theoreticalMinutes?: number;
  practicalMinutes?: number;
  habilitationOverride?: HabilitationKind | null;
}): Promise<GenerateResult> {
  const { data: clazz, error: classErr } = await input.ctx.supabase
    .from("process_classes")
    .select(
      "id, starts_at, status, instructor_id, location_id, template_stage:process_template_stages(id, template:process_templates(id, name, habilitation_kind)), instructor:instructors(id, full_name, cha_number, cha_category), location:class_locations(id, name, endereco, authority_id)",
    )
    .eq("account_id", input.ctx.accountId)
    .eq("id", input.classId)
    .maybeSingle();

  if (classErr || !clazz) {
    return { ok: false, status: 404, error: "Turma não encontrada." };
  }
  if (clazz.status === "canceled") {
    return { ok: false, status: 400, error: "Turma cancelada." };
  }

  const { data: enrollment, error: enrErr } = await input.ctx.supabase
    .from("process_class_enrollments")
    .select(
      "id, process_id, process:enrollment_processes(id, contact_id, contact:contacts(id, name, cpf, phone, email, endereco, numero, bairro, cidade, estado, complemento, cep, doc_numero, doc_orgao_emissor))",
    )
    .eq("account_id", input.ctx.accountId)
    .eq("id", input.enrollmentId)
    .eq("class_id", input.classId)
    .maybeSingle();

  if (enrErr || !enrollment) {
    return { ok: false, status: 404, error: "Aluno não encontrado nesta turma." };
  }

  const stage = asSingle(
    clazz.template_stage as
      | {
          template?: {
            name?: string;
            habilitation_kind?: string | null;
          } | null;
        }
      | {
          template?: {
            name?: string;
            habilitation_kind?: string | null;
          } | null;
        }[]
      | null,
  );
  const template = stage?.template ?? null;
  const habilitation =
    input.habilitationOverride ??
    resolveHabilitationKind({
      habilitation_kind: template?.habilitation_kind,
      name: template?.name,
    });
  if (!habilitation) {
    return {
      ok: false,
      status: 400,
      error: "Não foi possível determinar se a turma é Arrais ou Motonauta.",
    };
  }

  const process = asSingle(
    enrollment.process as
      | { id: string; contact?: unknown }
      | { id: string; contact?: unknown }[]
      | null,
  );
  const contactRow = asSingle(
    process?.contact as Record<string, unknown> | Record<string, unknown>[] | null,
  );
  if (!process || !contactRow) {
    return { ok: false, status: 400, error: "Processo/contato ausente." };
  }

  const contact = mapContact(contactRow);
  const instructorRaw = asSingle(
    clazz.instructor as Record<string, unknown> | Record<string, unknown>[] | null,
  );
  const locationRaw = asSingle(
    clazz.location as Record<string, unknown> | Record<string, unknown>[] | null,
  );
  const instructor = instructorRaw
    ? {
        id: String(instructorRaw.id),
        full_name: String(instructorRaw.full_name ?? ""),
        cha_number: String(instructorRaw.cha_number ?? ""),
        cha_category: String(instructorRaw.cha_category ?? ""),
      }
    : null;
  const location = locationRaw
    ? {
        id: String(locationRaw.id),
        name: String(locationRaw.name ?? ""),
        endereco: (locationRaw.endereco as string | null) ?? null,
        authority_id:
          locationRaw.authority_id == null
            ? null
            : Number(locationRaw.authority_id),
      }
    : null;

  const validation = validateAtestadoContext({
    contact,
    instructor,
    location,
  });
  if (!validation.ok || !instructor || !location) {
    return {
      ok: false,
      status: 400,
      error: "Dados insuficientes para o atestado.",
      gaps: validation.ok ? undefined : validation.gaps,
    };
  }

  const { data: jurRows, error: jurErr } = await input.ctx.supabase
    .from("account_jurisdictions")
    .select(
      "authority_id, responsible_user_id, email_override, authority:maritime_authorities(sigla, nome, email), responsible:profiles!account_jurisdictions_responsible_user_id_fkey(full_name)",
    )
    .eq("account_id", input.ctx.accountId);

  if (jurErr) {
    console.error("[generateAtestadoForEnrollment] jurisdictions", jurErr);
    return { ok: false, status: 500, error: "Falha ao resolver jurisdição." };
  }

  const links = (jurRows ?? []).map((row) => {
    const auth = asSingle(
      row.authority as
        | { sigla?: string; nome?: string; email?: string | null }
        | { sigla?: string; nome?: string; email?: string | null }[]
        | null,
    );
    const resp = asSingle(
      row.responsible as
        | { full_name?: string }
        | { full_name?: string }[]
        | null,
    );
    return {
      authority_id: Number(row.authority_id),
      responsible_user_id: String(row.responsible_user_id),
      responsible_full_name: resp?.full_name ?? null,
      email_override: (row.email_override as string | null) ?? null,
      catalog_email: auth?.email ?? null,
      authority_sigla: auth?.sigla ?? "",
      authority_nome: auth?.nome ?? "",
    };
  });

  const responsible = resolveResponsibleForLocation({
    authorityId: location.authority_id,
    links,
  });
  if (!responsible.ok) {
    const gapMsg: Record<string, string> = {
      missing_authority_on_location:
        "Local sem jurisdição. Edite o local de aula e selecione a OM/STA.",
      jurisdiction_not_linked:
        "Jurisdição do local não está vinculada à escola.",
      responsible_name_empty: "Responsável da jurisdição sem nome no perfil.",
    };
    return {
      ok: false,
      status: 400,
      error: gapMsg[responsible.gap] ?? "Jurisdição incompleta para o atestado.",
      gaps: [responsible.gap],
    };
  }

  const kind = atestadoKindFor(habilitation);
  const defaults =
    habilitation === "motonauta"
      ? { hours: "2 horas (60+60 min)", theo: 60, prac: 60 }
      : { hours: "6 horas", theo: 120, prac: 240 };

  const payload: DocumentPayload = {
    kind,
    contact,
    instructor,
    location,
    school: {
      name: input.ctx.accountName,
      responsibleName: responsible.responsibleName,
      authoritySigla: responsible.authoritySigla,
      authorityNome: responsible.authorityNome,
    },
    classStartsAt: formatDateTime(String(clazz.starts_at)),
    trainingHoursLabel: input.trainingHoursLabel?.trim() || defaults.hours,
    theoreticalMinutes: input.theoreticalMinutes ?? defaults.theo,
    practicalMinutes: input.practicalMinutes ?? defaults.prac,
  };

  return persistPdf({
    ctx: input.ctx,
    kind,
    contactId: contact.id,
    processId: process.id,
    classId: input.classId,
    enrollmentId: input.enrollmentId,
    payload,
    fileLabel: kind.replace(/_/g, "-"),
  });
}
