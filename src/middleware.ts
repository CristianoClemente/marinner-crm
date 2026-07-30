import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  getApexUrl,
  getAuthCookieOptions,
  getTenantUrl,
  parseHost,
} from "@/lib/domain";
import {
  TENANT_ACCOUNT_ID_HEADER,
  TENANT_LOGO_URL_HEADER,
  TENANT_NAME_HEADER,
  TENANT_SLUG_HEADER,
} from "@/lib/tenant/headers";
import { lookupTenantBySlug } from "@/lib/tenant/lookup";
import type { TenantBrandRow } from "@/lib/tenant/headers";

const PROTECTED_PATHS = [
  "/dashboard",
  "/inbox",
  "/contacts",
  "/pipelines",
  "/broadcasts",
  "/automations",
  "/settings",
  "/agents",
  "/flows",
  "/catalog",
  "/pos",
  "/class-locations",
  "/equipment",
  "/instructors",
  "/my-availability",
  "/notifications",
] as const;

const AUTH_PATHS = ["/login", "/signup", "/forgot-password"] as const;

const TENANT_ERROR_PATHS = ["/escola-nao-encontrada", "/sem-acesso"] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function stripTenantHeaders(headers: Headers): void {
  headers.delete(TENANT_SLUG_HEADER);
  headers.delete(TENANT_ACCOUNT_ID_HEADER);
  headers.delete(TENANT_NAME_HEADER);
  headers.delete(TENANT_LOGO_URL_HEADER);
}

function applyTenantHeaders(headers: Headers, tenant: TenantBrandRow): void {
  headers.set(TENANT_SLUG_HEADER, tenant.slug);
  headers.set(TENANT_ACCOUNT_ID_HEADER, tenant.id);
  headers.set(TENANT_NAME_HEADER, tenant.name);
  if (tenant.logo_url) {
    headers.set(TENANT_LOGO_URL_HEADER, tenant.logo_url);
  } else {
    headers.delete(TENANT_LOGO_URL_HEADER);
  }
}

function resolveCandidateSlug(request: NextRequest): {
  kind: "none" | "www" | "reserved" | "slug";
  slug?: string;
} {
  const host = request.headers.get("host") ?? "";
  const parsed = parseHost(host);

  if (parsed.kind === "www") return { kind: "www" };
  if (parsed.kind === "reserved") return { kind: "reserved", slug: parsed.sub };
  if (parsed.kind === "tenant") return { kind: "slug", slug: parsed.slug };

  // Apex: optional dev header
  if (process.env.NODE_ENV === "development") {
    const fromHeader = request.headers.get(TENANT_SLUG_HEADER)?.trim().toLowerCase();
    if (fromHeader) return { kind: "slug", slug: fromHeader };
  }

  return { kind: "none" };
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const cookieOptions = getAuthCookieOptions();

  // --- Host → tenant -------------------------------------------------------
  const candidate = resolveCandidateSlug(request);

  if (candidate.kind === "www") {
    const apex = new URL(getApexUrl());
    apex.pathname = pathname;
    apex.search = request.nextUrl.search;
    return NextResponse.redirect(apex);
  }

  if (candidate.kind === "reserved") {
    const apex = new URL(getApexUrl());
    apex.pathname = "/escola-nao-encontrada";
    apex.search = "";
    return NextResponse.redirect(apex);
  }

  let tenant: TenantBrandRow | null = null;
  if (candidate.kind === "slug" && candidate.slug) {
    tenant = await lookupTenantBySlug(candidate.slug);
    if (!tenant) {
      // Evita loop no Host inválido: erro sempre no apex
      const apex = new URL(getApexUrl());
      apex.pathname = "/escola-nao-encontrada";
      return NextResponse.redirect(apex);
    }
  }

  const requestHeaders = new Headers(request.headers);
  stripTenantHeaders(requestHeaders);
  if (tenant) applyTenantHeaders(requestHeaders, tenant);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...cookieOptions,
            }),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const withRefreshedCookies = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });
    return response;
  };

  // Auth pages — redirect if already logged in
  if (
    user &&
    (AUTH_PATHS as readonly string[]).includes(pathname)
  ) {
    const inviteToken = request.nextUrl.searchParams.get("invite");
    if (
      inviteToken &&
      (pathname === "/login" || pathname === "/signup")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`;
      url.search = "";
      return withRefreshedCookies(NextResponse.redirect(url));
    }

    // Híbrido: no apex, se a account tem slug → dashboard do tenant
    if (!tenant) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.account_id) {
        const { data: account } = await supabase
          .from("accounts")
          .select("slug")
          .eq("id", profile.account_id)
          .maybeSingle();
        if (account?.slug) {
          return withRefreshedCookies(
            NextResponse.redirect(
              new URL(getTenantUrl(account.slug as string, "/dashboard")),
            ),
          );
        }
      }
    }

    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  // Protected — require auth
  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return withRefreshedCookies(NextResponse.redirect(url));
  }

  // Membership: usuário no tenant de outra escola
  if (
    user &&
    tenant &&
    isProtectedPath(pathname) &&
    !(TENANT_ERROR_PATHS as readonly string[]).includes(pathname)
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.account_id || profile.account_id !== tenant.id) {
      const url = request.nextUrl.clone();
      url.pathname = "/sem-acesso";
      url.search = "";
      return withRefreshedCookies(NextResponse.redirect(url));
    }
  }

  // WhatsApp API auth (exceto webhook)
  if (
    !user &&
    request.nextUrl.pathname.startsWith("/api/whatsapp/") &&
    !request.nextUrl.pathname.includes("/webhook")
  ) {
    return withRefreshedCookies(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
