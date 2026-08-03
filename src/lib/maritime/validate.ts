/**
 * Validação de vínculos de jurisdição OM/STA por conta.
 */

export type JurisdictionValidateError =
  | "invalid_body"
  | "invalid_authority"
  | "invalid_responsible"
  | "invalid_email"
  | "nothing_to_update";

export type JurisdictionCreateInput = {
  authority_id: number;
  responsible_user_id: string;
  email_override: string | null;
  is_default: boolean;
};

export type JurisdictionPatchInput = {
  responsible_user_id?: string;
  email_override?: string | null;
  is_default?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function parseEmailOverride(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const v = raw.trim();
  if (v.length === 0) return { ok: true, value: null };
  if (v.length > 200 || !v.includes("@")) return { ok: false };
  return { ok: true, value: v };
}

export function effectiveJurisdictionEmail(
  override: string | null | undefined,
  catalogEmail: string | null | undefined,
): string | null {
  const o = typeof override === "string" ? override.trim() : "";
  if (o) return o;
  const c = typeof catalogEmail === "string" ? catalogEmail.trim() : "";
  return c || null;
}

export function canAddJurisdiction(
  currentCount: number,
  maxJurisdictions: number | null,
): boolean {
  if (maxJurisdictions === null) return true;
  return currentCount < maxJurisdictions;
}

export function validateJurisdictionCreate(
  body: unknown,
):
  | { ok: true; value: JurisdictionCreateInput }
  | { ok: false; error: JurisdictionValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: "invalid_body",
      message: "Corpo inválido.",
    };
  }
  const b = body as Record<string, unknown>;
  const authorityRaw = b.authority_id;
  const authority_id =
    typeof authorityRaw === "number"
      ? authorityRaw
      : typeof authorityRaw === "string" && /^\d+$/.test(authorityRaw.trim())
        ? Number(authorityRaw.trim())
        : NaN;
  if (!Number.isInteger(authority_id) || authority_id < 1) {
    return {
      ok: false,
      error: "invalid_authority",
      message: "Jurisdição inválida.",
    };
  }
  if (!isUuid(b.responsible_user_id)) {
    return {
      ok: false,
      error: "invalid_responsible",
      message: "Responsável inválido.",
    };
  }
  const email = parseEmailOverride(b.email_override);
  if (!email.ok) {
    return {
      ok: false,
      error: "invalid_email",
      message: "E-mail inválido.",
    };
  }
  return {
    ok: true,
    value: {
      authority_id,
      responsible_user_id: b.responsible_user_id,
      email_override: email.value,
      is_default: b.is_default === true,
    },
  };
}

export function validateJurisdictionPatch(
  body: unknown,
):
  | { ok: true; value: JurisdictionPatchInput }
  | { ok: false; error: JurisdictionValidateError; message: string } {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: "invalid_body",
      message: "Corpo inválido.",
    };
  }
  const b = body as Record<string, unknown>;
  const patch: JurisdictionPatchInput = {};

  if (b.responsible_user_id !== undefined) {
    if (!isUuid(b.responsible_user_id)) {
      return {
        ok: false,
        error: "invalid_responsible",
        message: "Responsável inválido.",
      };
    }
    patch.responsible_user_id = b.responsible_user_id;
  }

  if (b.email_override !== undefined) {
    const email = parseEmailOverride(b.email_override);
    if (!email.ok) {
      return {
        ok: false,
        error: "invalid_email",
        message: "E-mail inválido.",
      };
    }
    patch.email_override = email.value;
  }

  if (b.is_default !== undefined) {
    if (typeof b.is_default !== "boolean") {
      return {
        ok: false,
        error: "invalid_body",
        message: "Corpo inválido.",
      };
    }
    patch.is_default = b.is_default;
  }

  if (
    patch.responsible_user_id === undefined &&
    patch.email_override === undefined &&
    patch.is_default === undefined
  ) {
    return {
      ok: false,
      error: "nothing_to_update",
      message: "Nada para atualizar.",
    };
  }

  return { ok: true, value: patch };
}
