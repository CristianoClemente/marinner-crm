/**
 * Domínio do SaaS Marinner — apex vs tenant (subdomínio por empresa).
 *
 * Env:
 * - DOMAIN_BASE — ex.: marinner.com.br (prod) ou localhost (dev)
 * - NEXT_PUBLIC_SITE_URL — URL canônica do apex (scheme + host, sem barra final)
 *
 * Resolução de tenant por Host entra na Sprint S12; aqui só config/helpers.
 */

export const DEFAULT_DOMAIN_BASE = "marinner.com.br";

/** Host apex reservados (não são slug de empresa). */
export const APEX_SUBDOMAINS = ["app", "www", "admin", "api", "mail"] as const;

export function getDomainBase(): string {
  const raw = process.env.DOMAIN_BASE?.trim().toLowerCase();
  if (raw) return raw.replace(/^\.+/, "").replace(/\.$/, "");
  return DEFAULT_DOMAIN_BASE;
}

/**
 * URL canônica do apex (login / marketing / onboarding sem tenant).
 * Preferir NEXT_PUBLIC_SITE_URL; senão monta https://app.{DOMAIN_BASE}.
 */
export function getApexUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const base = getDomainBase();
  if (base === "localhost" || base.endsWith(".localhost")) {
    return "http://localhost:3000";
  }
  return `https://app.${base}`;
}

/** Host do apex, ex.: app.marinner.com.br */
export function getApexHost(): string {
  try {
    return new URL(getApexUrl()).host;
  } catch {
    return `app.${getDomainBase()}`;
  }
}

/**
 * URL do tenant por slug, ex.: https://escola.marinner.com.br
 * Em localhost (dev pré-S14): http://{slug}.localhost:3000
 */
export function getTenantUrl(slug: string, path = ""): string {
  const cleanSlug = slug.trim().toLowerCase();
  const base = getDomainBase();
  const suffix = path
    ? path.startsWith("/")
      ? path
      : `/${path}`
    : "";

  if (base === "localhost" || base.endsWith(".localhost")) {
    return `http://${cleanSlug}.localhost:3000${suffix}`;
  }
  return `https://${cleanSlug}.${base}${suffix}`;
}

export function isReservedSubdomain(sub: string): boolean {
  const s = sub.trim().toLowerCase();
  return (APEX_SUBDOMAINS as readonly string[]).includes(s);
}
