import {
  canShareAuthAcrossSubdomains,
  getTenantUrl,
  parseHost,
} from "@/lib/domain";

export type PostLoginAccount = {
  id: string;
  slug: string | null;
};

export type PostLoginNavigation =
  | { kind: "path"; href: string }
  | { kind: "sem-acesso" };

/**
 * Destino após sign-in bem-sucedido.
 * No Host do tenant, nunca redireciona para o slug da conta do usuário —
 * se a conta não for da escola do Host, bloqueia em /sem-acesso.
 *
 * Preferir `hostAccountId` (header do middleware) vs `account.id`.
 * Se `/api/account` falhar (`account` null), vai para `/dashboard` e o
 * middleware aplica membership — evita falso positivo em /sem-acesso.
 */
export function resolvePostLoginNavigation(input: {
  inviteToken: string | null;
  host: string;
  account: PostLoginAccount | null;
  /** account.id da escola do Host (quando o middleware resolveu o tenant). */
  hostAccountId?: string | null;
  canShareAuth?: boolean;
}): PostLoginNavigation {
  if (input.inviteToken) {
    return {
      kind: "path",
      href: `/join/${encodeURIComponent(input.inviteToken)}`,
    };
  }

  const parsed = parseHost(input.host);
  if (parsed.kind === "tenant") {
    if (!input.account) {
      return { kind: "path", href: "/dashboard" };
    }

    const hostAccountId = input.hostAccountId?.trim() || null;
    if (hostAccountId) {
      if (input.account.id !== hostAccountId) {
        return { kind: "sem-acesso" };
      }
      return { kind: "path", href: "/dashboard" };
    }

    const accountSlug = input.account.slug?.trim().toLowerCase() ?? null;
    if (!accountSlug || accountSlug !== parsed.slug) {
      return { kind: "sem-acesso" };
    }
    return { kind: "path", href: "/dashboard" };
  }

  const share = input.canShareAuth ?? canShareAuthAcrossSubdomains();
  const slug = input.account?.slug?.trim().toLowerCase();
  if (slug && share) {
    return { kind: "path", href: getTenantUrl(slug, "/dashboard") };
  }

  return { kind: "path", href: "/dashboard" };
}
