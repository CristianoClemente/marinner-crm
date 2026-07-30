/**
 * Validação de fichas de instrutor, weekly e indisponibilidade.
 */

export const INSTRUCTOR_NAME_MAX = 120;
export const INSTRUCTOR_PHONE_MAX = 32;
export const INSTRUCTOR_CHA_NUMBER_MAX = 64;
export const INSTRUCTOR_PIX_MAX = 77;
export const INSTRUCTOR_REASON_MAX = 500;

export type ChaCategory =
  | "mta"
  | "ara"
  | "mtr"
  | "cpa"
  | "mta_ara"
  | "mta_mtr"
  | "mta_cpa";

export type InstructorStatus = "active" | "inactive";

export const CHA_CATEGORIES: readonly ChaCategory[] = [
  "mta",
  "ara",
  "mtr",
  "cpa",
  "mta_ara",
  "mta_mtr",
  "mta_cpa",
] as const;

const CHA_SET = new Set<ChaCategory>(CHA_CATEGORIES);
const STATUS_SET = new Set<InstructorStatus>(["active", "inactive"]);

export type InstructorValidateError =
  | "invalid_body"
  | "empty_name"
  | "invalid_phone"
  | "invalid_date"
  | "invalid_cha_number"
  | "invalid_cha_category"
  | "invalid_pix"
  | "invalid_status"
  | "invalid_weekday"
  | "invalid_weekdays"
  | "nothing_to_update";

export interface InstructorCreateInput {
  full_name: string;
  phone: string;
  birth_date: string;
  cha_number: string;
  cha_category: ChaCategory;
  cha_expires_on: string;
  pix_key: string;
  status: InstructorStatus;
}

export interface InstructorPatchInput {
  full_name?: string;
  phone?: string;
  birth_date?: string;
  cha_number?: string;
  cha_category?: ChaCategory;
  cha_expires_on?: string;
  pix_key?: string;
  status?: InstructorStatus;
}

export interface WeeklyReplaceInput {
  weekdays: number[];
}

export interface UnavailabilityCreateInput {
  on_date: string;
  reason: string | null;
}

export function isChaCategory(v: unknown): v is ChaCategory {
  return typeof v === "string" && CHA_SET.has(v as ChaCategory);
}

export function isInstructorStatus(v: unknown): v is InstructorStatus {
  return typeof v === "string" && STATUS_SET.has(v as InstructorStatus);
}

function trimRequired(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > max) return null;
  return v;
}

function parseDateOnly(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return null;
  }
  const d = raw.trim();
  if (Number.isNaN(new Date(`${d}T00:00:00.000Z`).getTime())) return null;
  return d;
}

/** PIX básico: não vazio, sem espaços internos, até 77 chars. */
export function isValidPixKey(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const v = raw.trim();
  if (!v || v.length > INSTRUCTOR_PIX_MAX) return false;
  if (/\s/.test(v)) return false;
  return true;
}

export function validateInstructorCreate(
  body: unknown,
):
  | { ok: true; value: InstructorCreateInput }
  | { ok: false; error: InstructorValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;

  const full_name = trimRequired(b.full_name, INSTRUCTOR_NAME_MAX);
  if (!full_name) {
    return { ok: false, error: "empty_name", message: "Nome é obrigatório" };
  }

  const phone = trimRequired(b.phone, INSTRUCTOR_PHONE_MAX);
  if (!phone) {
    return {
      ok: false,
      error: "invalid_phone",
      message: "Telefone é obrigatório",
    };
  }

  const birth_date = parseDateOnly(b.birth_date);
  if (!birth_date) {
    return {
      ok: false,
      error: "invalid_date",
      message: "Data de nascimento inválida",
    };
  }

  const cha_number = trimRequired(b.cha_number, INSTRUCTOR_CHA_NUMBER_MAX);
  if (!cha_number) {
    return {
      ok: false,
      error: "invalid_cha_number",
      message: "Número do CHA é obrigatório",
    };
  }

  if (!isChaCategory(b.cha_category)) {
    return {
      ok: false,
      error: "invalid_cha_category",
      message: "Categoria do CHA inválida",
    };
  }

  const cha_expires_on = parseDateOnly(b.cha_expires_on);
  if (!cha_expires_on) {
    return {
      ok: false,
      error: "invalid_date",
      message: "Validade do CHA inválida",
    };
  }

  if (!isValidPixKey(b.pix_key)) {
    return {
      ok: false,
      error: "invalid_pix",
      message: "Chave PIX inválida",
    };
  }
  const pix_key = (b.pix_key as string).trim();

  const status =
    b.status === undefined || b.status === null
      ? "active"
      : isInstructorStatus(b.status)
        ? b.status
        : null;
  if (!status) {
    return {
      ok: false,
      error: "invalid_status",
      message: "Status inválido",
    };
  }

  return {
    ok: true,
    value: {
      full_name,
      phone,
      birth_date,
      cha_number,
      cha_category: b.cha_category,
      cha_expires_on,
      pix_key,
      status,
    },
  };
}

export function validateInstructorPatch(
  body: unknown,
):
  | { ok: true; value: InstructorPatchInput }
  | { ok: false; error: InstructorValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  const patch: InstructorPatchInput = {};

  if ("full_name" in b) {
    const full_name = trimRequired(b.full_name, INSTRUCTOR_NAME_MAX);
    if (!full_name) {
      return { ok: false, error: "empty_name", message: "Nome é obrigatório" };
    }
    patch.full_name = full_name;
  }
  if ("phone" in b) {
    const phone = trimRequired(b.phone, INSTRUCTOR_PHONE_MAX);
    if (!phone) {
      return {
        ok: false,
        error: "invalid_phone",
        message: "Telefone inválido",
      };
    }
    patch.phone = phone;
  }
  if ("birth_date" in b) {
    const birth_date = parseDateOnly(b.birth_date);
    if (!birth_date) {
      return {
        ok: false,
        error: "invalid_date",
        message: "Data de nascimento inválida",
      };
    }
    patch.birth_date = birth_date;
  }
  if ("cha_number" in b) {
    const cha_number = trimRequired(b.cha_number, INSTRUCTOR_CHA_NUMBER_MAX);
    if (!cha_number) {
      return {
        ok: false,
        error: "invalid_cha_number",
        message: "Número do CHA inválido",
      };
    }
    patch.cha_number = cha_number;
  }
  if ("cha_category" in b) {
    if (!isChaCategory(b.cha_category)) {
      return {
        ok: false,
        error: "invalid_cha_category",
        message: "Categoria do CHA inválida",
      };
    }
    patch.cha_category = b.cha_category;
  }
  if ("cha_expires_on" in b) {
    const cha_expires_on = parseDateOnly(b.cha_expires_on);
    if (!cha_expires_on) {
      return {
        ok: false,
        error: "invalid_date",
        message: "Validade do CHA inválida",
      };
    }
    patch.cha_expires_on = cha_expires_on;
  }
  if ("pix_key" in b) {
    if (!isValidPixKey(b.pix_key)) {
      return {
        ok: false,
        error: "invalid_pix",
        message: "Chave PIX inválida",
      };
    }
    patch.pix_key = (b.pix_key as string).trim();
  }
  if ("status" in b) {
    if (!isInstructorStatus(b.status)) {
      return {
        ok: false,
        error: "invalid_status",
        message: "Status inválido",
      };
    }
    patch.status = b.status;
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: "nothing_to_update",
      message: "Nada para atualizar",
    };
  }
  return { ok: true, value: patch };
}

export function validateWeeklyReplace(
  body: unknown,
):
  | { ok: true; value: WeeklyReplaceInput }
  | { ok: false; error: InstructorValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.weekdays)) {
    return {
      ok: false,
      error: "invalid_weekdays",
      message: "weekdays deve ser um array",
    };
  }

  const seen = new Set<number>();
  const weekdays: number[] = [];
  for (const raw of b.weekdays) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 6) {
      return {
        ok: false,
        error: "invalid_weekday",
        message: "Dia da semana inválido (0–6)",
      };
    }
    if (!seen.has(raw)) {
      seen.add(raw);
      weekdays.push(raw);
    }
  }
  weekdays.sort((a, c) => a - c);
  return { ok: true, value: { weekdays } };
}

export function validateUnavailabilityCreate(
  body: unknown,
):
  | { ok: true; value: UnavailabilityCreateInput }
  | { ok: false; error: InstructorValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  const on_date = parseDateOnly(b.on_date);
  if (!on_date) {
    return {
      ok: false,
      error: "invalid_date",
      message: "Data de indisponibilidade inválida",
    };
  }

  let reason: string | null = null;
  if (b.reason !== undefined && b.reason !== null && b.reason !== "") {
    if (typeof b.reason !== "string") {
      return {
        ok: false,
        error: "invalid_body",
        message: "Motivo inválido",
      };
    }
    const trimmed = b.reason.trim();
    if (!trimmed || trimmed.length > INSTRUCTOR_REASON_MAX) {
      return {
        ok: false,
        error: "invalid_body",
        message: "Motivo inválido",
      };
    }
    reason = trimmed;
  }

  return { ok: true, value: { on_date, reason } };
}
