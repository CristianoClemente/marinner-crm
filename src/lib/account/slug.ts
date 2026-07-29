/**
 * Slug de conta — subdomínio futuro (Fatia 2: Host → tenant).
 *
 * Regras alinhadas ao CHECK em 042_account_branding.sql e a
 * `isReservedSubdomain` em `@/lib/domain`.
 */

import { isReservedSubdomain } from "@/lib/domain";

export const SLUG_MIN_LEN = 3;
export const SLUG_MAX_LEN = 48;

/** Shape: começa/termina alfanumérico; hífens no meio. */
const SLUG_RE = /^[a-z0-9]([a-z0-9-]{1,46}[a-z0-9])$/;

/**
 * Normaliza entrada do usuário: trim, lower-case, espaços→hífen,
 * remove chars inválidos, colapsa hífens.
 */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SlugValidationError =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_format"
  | "reserved";

export interface SlugValidationResult {
  ok: boolean;
  slug: string;
  error?: SlugValidationError;
}

/** Valida slug já normalizado (ou normaliza se `raw` vier cru). */
export function validateSlug(raw: string): SlugValidationResult {
  const slug = normalizeSlug(raw);
  if (!slug) {
    return { ok: false, slug, error: "empty" };
  }
  if (slug.length < SLUG_MIN_LEN) {
    return { ok: false, slug, error: "too_short" };
  }
  if (slug.length > SLUG_MAX_LEN) {
    return { ok: false, slug, error: "too_long" };
  }
  if (!SLUG_RE.test(slug)) {
    return { ok: false, slug, error: "invalid_format" };
  }
  if (isReservedSubdomain(slug)) {
    return { ok: false, slug, error: "reserved" };
  }
  return { ok: true, slug };
}
