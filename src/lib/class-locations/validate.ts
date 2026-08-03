/**
 * Validação de locais de aula e regras de bônus.
 */

export const LOCATION_NAME_MAX = 120;
export const LOCATION_FIELD_MAX = 120;
export const LOCATION_CEP_MAX = 16;

export type LocationStatus = "active" | "inactive";

export type LocationCostType =
  | "monthly_fee"
  | "per_class"
  | "per_day"
  | "per_student";

const STATUS_SET = new Set<LocationStatus>(["active", "inactive"]);
const COST_TYPE_SET = new Set<LocationCostType>([
  "monthly_fee",
  "per_class",
  "per_day",
  "per_student",
]);

export function isLocationStatus(value: unknown): value is LocationStatus {
  return typeof value === "string" && STATUS_SET.has(value as LocationStatus);
}

export function isLocationCostType(value: unknown): value is LocationCostType {
  return (
    typeof value === "string" && COST_TYPE_SET.has(value as LocationCostType)
  );
}

function trimOrNull(raw: unknown, max: number): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim();
  if (v.length === 0) return null;
  if (v.length > max) return undefined;
  return v;
}

function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw.trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type LocationValidateError =
  | "invalid_body"
  | "empty_name"
  | "name_too_long"
  | "field_too_long"
  | "invalid_status"
  | "invalid_expense"
  | "invalid_bonus"
  | "invalid_dates"
  | "missing_authority"
  | "invalid_authority"
  | "nothing_to_update";

export interface ClassLocationCreateInput {
  name: string;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  status: LocationStatus;
  has_expense: boolean;
  expense_type: LocationCostType | null;
  expense_amount: number | null;
  authority_id: number;
}

export interface ClassLocationPatchInput {
  name?: string;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  status?: LocationStatus;
  has_expense?: boolean;
  expense_type?: LocationCostType | null;
  expense_amount?: number | null;
  authority_id?: number;
}

function parseAuthorityId(
  raw: unknown,
):
  | { ok: true; value: number }
  | { ok: false; error: LocationValidateError; message: string } {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string" && /^\d+$/.test(raw.trim())
        ? Number(raw.trim())
        : NaN;
  if (!Number.isInteger(n) || n < 1) {
    return {
      ok: false,
      error: "invalid_authority",
      message: "Jurisdição inválida",
    };
  }
  return { ok: true, value: n };
}

function readAddressFields(
  b: Record<string, unknown>,
):
  | {
      ok: true;
      value: Pick<
        ClassLocationCreateInput,
        | "endereco"
        | "numero"
        | "complemento"
        | "bairro"
        | "cidade"
        | "estado"
        | "cep"
      >;
    }
  | { ok: false; error: LocationValidateError; message: string } {
  const fields = [
    "endereco",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "cep",
  ] as const;
  const value: Record<string, string | null> = {};
  for (const key of fields) {
    if (!(key in b)) {
      value[key] = null;
      continue;
    }
    const max = key === "cep" ? LOCATION_CEP_MAX : LOCATION_FIELD_MAX;
    const parsed = trimOrNull(b[key], max);
    if (parsed === undefined) {
      return {
        ok: false,
        error: "field_too_long",
        message: `Campo ${key} inválido ou muito longo`,
      };
    }
    value[key] = parsed;
  }
  return {
    ok: true,
    value: value as Pick<
      ClassLocationCreateInput,
      | "endereco"
      | "numero"
      | "complemento"
      | "bairro"
      | "cidade"
      | "estado"
      | "cep"
    >,
  };
}

function normalizeExpense(
  has_expense: boolean,
  expense_type: unknown,
  expense_amount: unknown,
):
  | {
      ok: true;
      expense_type: LocationCostType | null;
      expense_amount: number | null;
    }
  | { ok: false; error: LocationValidateError; message: string } {
  if (!has_expense) {
    if (
      (expense_type !== undefined &&
        expense_type !== null &&
        expense_type !== "") ||
      (expense_amount !== undefined &&
        expense_amount !== null &&
        expense_amount !== "")
    ) {
      return {
        ok: false,
        error: "invalid_expense",
        message: "Sem despesa, tipo e valor devem ficar vazios",
      };
    }
    return { ok: true, expense_type: null, expense_amount: null };
  }

  if (!isLocationCostType(expense_type)) {
    return {
      ok: false,
      error: "invalid_expense",
      message: "Tipo de despesa obrigatório",
    };
  }
  const amount = parseAmount(expense_amount);
  if (amount === null || amount < 0) {
    return {
      ok: false,
      error: "invalid_expense",
      message: "Valor da despesa inválido",
    };
  }
  return {
    ok: true,
    expense_type,
    expense_amount: Math.round(amount * 100) / 100,
  };
}

export function validateClassLocationCreate(
  body: unknown,
):
  | { ok: true; value: ClassLocationCreateInput }
  | { ok: false; error: LocationValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim().length === 0) {
    return { ok: false, error: "empty_name", message: "Nome é obrigatório" };
  }
  const name = b.name.trim();
  if (name.length > LOCATION_NAME_MAX) {
    return { ok: false, error: "name_too_long", message: "Nome muito longo" };
  }

  const address = readAddressFields(b);
  if (!address.ok) return address;

  const status =
    b.status === undefined || b.status === null
      ? "active"
      : isLocationStatus(b.status)
        ? b.status
        : null;
  if (!status) {
    return {
      ok: false,
      error: "invalid_status",
      message: "Status inválido",
    };
  }

  const has_expense = Boolean(b.has_expense);
  const expense = normalizeExpense(has_expense, b.expense_type, b.expense_amount);
  if (!expense.ok) return expense;

  if (!("authority_id" in b) || b.authority_id === null || b.authority_id === "") {
    return {
      ok: false,
      error: "missing_authority",
      message: "Jurisdição é obrigatória",
    };
  }
  const authority = parseAuthorityId(b.authority_id);
  if (!authority.ok) return authority;

  return {
    ok: true,
    value: {
      name,
      ...address.value,
      status,
      has_expense,
      expense_type: expense.expense_type,
      expense_amount: expense.expense_amount,
      authority_id: authority.value,
    },
  };
}

export function validateClassLocationPatch(
  body: unknown,
):
  | { ok: true; value: ClassLocationPatchInput }
  | { ok: false; error: LocationValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  const patch: ClassLocationPatchInput = {};

  if ("name" in b) {
    if (typeof b.name !== "string" || b.name.trim().length === 0) {
      return { ok: false, error: "empty_name", message: "Nome é obrigatório" };
    }
    const name = b.name.trim();
    if (name.length > LOCATION_NAME_MAX) {
      return { ok: false, error: "name_too_long", message: "Nome muito longo" };
    }
    patch.name = name;
  }

  for (const key of [
    "endereco",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
    "cep",
  ] as const) {
    if (!(key in b)) continue;
    const max = key === "cep" ? LOCATION_CEP_MAX : LOCATION_FIELD_MAX;
    const parsed = trimOrNull(b[key], max);
    if (parsed === undefined) {
      return {
        ok: false,
        error: "field_too_long",
        message: `Campo ${key} inválido ou muito longo`,
      };
    }
    patch[key] = parsed;
  }

  if ("status" in b) {
    if (!isLocationStatus(b.status)) {
      return {
        ok: false,
        error: "invalid_status",
        message: "Status inválido",
      };
    }
    patch.status = b.status;
  }

  const touchesExpense =
    "has_expense" in b || "expense_type" in b || "expense_amount" in b;

  if (touchesExpense) {
    if (!("has_expense" in b)) {
      return {
        ok: false,
        error: "invalid_expense",
        message: "Informe has_expense ao alterar despesa",
      };
    }
    const has_expense = Boolean(b.has_expense);
    const expense = normalizeExpense(
      has_expense,
      b.expense_type,
      b.expense_amount,
    );
    if (!expense.ok) return expense;
    patch.has_expense = has_expense;
    patch.expense_type = expense.expense_type;
    patch.expense_amount = expense.expense_amount;
  }

  if ("authority_id" in b) {
    const authority = parseAuthorityId(b.authority_id);
    if (!authority.ok) return authority;
    patch.authority_id = authority.value;
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

export interface BonusRuleCreateInput {
  bonus_type: LocationCostType;
  bonus_amount: number;
  starts_on: string;
  ends_on: string | null;
  active: boolean;
}

export interface BonusRulePatchInput {
  bonus_type?: LocationCostType;
  bonus_amount?: number;
  starts_on?: string;
  ends_on?: string | null;
  active?: boolean;
}

function parseDateOnly(raw: unknown): string | null {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    return null;
  }
  const d = raw.trim();
  const dt = new Date(`${d}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return null;
  return d;
}

export function validateBonusRuleCreate(
  body: unknown,
):
  | { ok: true; value: BonusRuleCreateInput }
  | { ok: false; error: LocationValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;

  if (!isLocationCostType(b.bonus_type)) {
    return {
      ok: false,
      error: "invalid_bonus",
      message: "Tipo de bônus inválido",
    };
  }
  const amount = parseAmount(b.bonus_amount);
  if (amount === null || amount < 0) {
    return {
      ok: false,
      error: "invalid_bonus",
      message: "Valor do bônus inválido",
    };
  }

  const starts_on =
    b.starts_on === undefined || b.starts_on === null
      ? new Date().toISOString().slice(0, 10)
      : parseDateOnly(b.starts_on);
  if (!starts_on) {
    return {
      ok: false,
      error: "invalid_dates",
      message: "Data de início inválida",
    };
  }

  let ends_on: string | null = null;
  if (b.ends_on !== undefined && b.ends_on !== null && b.ends_on !== "") {
    ends_on = parseDateOnly(b.ends_on);
    if (!ends_on) {
      return {
        ok: false,
        error: "invalid_dates",
        message: "Data de fim inválida",
      };
    }
    if (ends_on < starts_on) {
      return {
        ok: false,
        error: "invalid_dates",
        message: "Data de fim deve ser ≥ início",
      };
    }
  }

  return {
    ok: true,
    value: {
      bonus_type: b.bonus_type,
      bonus_amount: Math.round(amount * 100) / 100,
      starts_on,
      ends_on,
      active: b.active === undefined ? true : Boolean(b.active),
    },
  };
}

export function validateBonusRulePatch(
  body: unknown,
):
  | { ok: true; value: BonusRulePatchInput }
  | { ok: false; error: LocationValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body", message: "Body inválido" };
  }
  const b = body as Record<string, unknown>;
  const patch: BonusRulePatchInput = {};

  if ("bonus_type" in b) {
    if (!isLocationCostType(b.bonus_type)) {
      return {
        ok: false,
        error: "invalid_bonus",
        message: "Tipo de bônus inválido",
      };
    }
    patch.bonus_type = b.bonus_type;
  }

  if ("bonus_amount" in b) {
    const amount = parseAmount(b.bonus_amount);
    if (amount === null || amount < 0) {
      return {
        ok: false,
        error: "invalid_bonus",
        message: "Valor do bônus inválido",
      };
    }
    patch.bonus_amount = Math.round(amount * 100) / 100;
  }

  if ("starts_on" in b) {
    const starts_on = parseDateOnly(b.starts_on);
    if (!starts_on) {
      return {
        ok: false,
        error: "invalid_dates",
        message: "Data de início inválida",
      };
    }
    patch.starts_on = starts_on;
  }

  if ("ends_on" in b) {
    if (b.ends_on === null || b.ends_on === "") {
      patch.ends_on = null;
    } else {
      const ends_on = parseDateOnly(b.ends_on);
      if (!ends_on) {
        return {
          ok: false,
          error: "invalid_dates",
          message: "Data de fim inválida",
        };
      }
      patch.ends_on = ends_on;
    }
  }

  if ("active" in b) {
    patch.active = Boolean(b.active);
  }

  if (Object.keys(patch).length === 0) {
    return {
      ok: false,
      error: "nothing_to_update",
      message: "Nada para atualizar",
    };
  }

  const start = patch.starts_on;
  const end = patch.ends_on;
  if (start && end && end < start) {
    return {
      ok: false,
      error: "invalid_dates",
      message: "Data de fim deve ser ≥ início",
    };
  }

  return { ok: true, value: patch };
}
