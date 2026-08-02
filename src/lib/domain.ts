/**
 * Domínio do SaaS Marinner — apex vs tenant (subdomínio por empresa).
 *
 * Env:
 * - DOMAIN_BASE — ex.: marinner.com.br (prod) ou localhost (dev)
 * - NEXT_PUBLIC_SITE_URL — URL canônica do apex (scheme + host, sem barra final)
 */

export const DEFAULT_DOMAIN_BASE = "marinner.com.br";

/** Host apex reservados (não são slug de empresa). */
export const APEX_SUBDOMAINS = ["app", "www", "admin", "api", "mail"] as const;

export type ParsedHost =
  | { kind: "apex" }
  | { kind: "www" }
  | { kind: "reserved"; sub: string }
  | { kind: "tenant"; slug: string };

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
 * Em localhost: http://{slug}.localhost:3000
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

/** Remove porta e normaliza host para comparação. */
export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

/**
 * Classifica o Host da request em apex / www / reservado / tenant.
 * Não consulta o banco — só parsing vs DOMAIN_BASE.
 */
export function parseHost(host: string): ParsedHost {
  const hostname = normalizeHost(host);
  const base = getDomainBase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  ) {
    return { kind: "apex" };
  }

  // Dev: {slug}.localhost
  if (base === "localhost" || base.endsWith(".localhost")) {
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      if (hostname === "localhost") return { kind: "apex" };
      const sub = hostname.slice(0, -".localhost".length);
      if (!sub || sub.includes(".")) return { kind: "apex" };
      if (sub === "app") return { kind: "apex" };
      if (sub === "www") return { kind: "www" };
      if (isReservedSubdomain(sub)) return { kind: "reserved", sub };
      return { kind: "tenant", slug: sub };
    }
    return { kind: "apex" };
  }

  // Prod: exact apex domain or *.DOMAIN_BASE
  if (hostname === base) return { kind: "apex" };

  const suffix = `.${base}`;
  if (!hostname.endsWith(suffix)) return { kind: "apex" };

  const sub = hostname.slice(0, -suffix.length);
  if (!sub || sub.includes(".")) return { kind: "apex" };
  if (sub === "app") return { kind: "apex" };
  if (sub === "www") return { kind: "www" };
  if (isReservedSubdomain(sub)) return { kind: "reserved", sub };
  return { kind: "tenant", slug: sub };
}

/**
 * Domain attribute for Supabase auth cookies so apex and tenant
 * subdomains share the same session.
 *
 * Em localhost **omitimos** o Domain: vários browsers rejeitam
 * `Domain=.localhost` no host `localhost`, e a sessão “loga e volta
 * pro login”. Tenant local usa header `x-tenant-slug` ou aceita
 * cookie host-only (ver docs/dominio-e-urls.md).
 */
export function getAuthCookieDomain(): string | undefined {
  const base = getDomainBase();
  if (base === "localhost" || base.endsWith(".localhost")) {
    return undefined;
  }
  return `.${base}`;
}

export function getAuthCookieOptions(): {
  domain?: string;
  path: string;
  sameSite: "lax";
  secure: boolean;
} {
  const isProd = process.env.NODE_ENV === "production";
  const domain = getAuthCookieDomain();
  return {
    ...(domain ? { domain } : {}),
    path: "/",
    sameSite: "lax",
    secure: isProd,
  };
}
