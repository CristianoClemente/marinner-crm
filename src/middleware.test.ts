import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// --- Scenario knobs the mock reads -----------------------------------------
let mockUser: { id: string } | null = null;
let refreshedCookies: Array<{
  name: string;
  value: string;
  options: Record<string, unknown>;
}> = [];
let mockProfileAccountId: string | null = null;
let mockAccountSlug: string | null = null;
let mockTenant: {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
} | null = null;

vi.mock("@/lib/tenant/lookup", () => ({
  lookupTenantBySlug: vi.fn(async () => mockTenant),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opts: {
      cookies: { setAll: (c: typeof refreshedCookies) => void };
    },
  ) => ({
    auth: {
      getUser: async () => {
        if (refreshedCookies.length) opts.cookies.setAll(refreshedCookies);
        return { data: { user: mockUser } };
      },
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "profiles") {
              return {
                data: mockProfileAccountId
                  ? { account_id: mockProfileAccountId }
                  : null,
                error: null,
              };
            }
            if (table === "accounts") {
              return {
                data: mockAccountSlug ? { slug: mockAccountSlug } : null,
                error: null,
              };
            }
            return { data: null, error: null };
          },
        }),
      }),
    }),
  }),
}));

const { middleware } = await import("./middleware");

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.DOMAIN_BASE = "escolanautica.app.br";
  process.env.NEXT_PUBLIC_DOMAIN_BASE = "escolanautica.app.br";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.escolanautica.app.br";
  mockUser = null;
  refreshedCookies = [];
  mockProfileAccountId = null;
  mockAccountSlug = null;
  mockTenant = null;
});

afterEach(() => vi.clearAllMocks());

const ROTATED = {
  name: "sb-test-auth-token",
  value: "rotated-refresh-token",
  options: { path: "/", httpOnly: true },
};

function req(url: string): NextRequest {
  const u = new URL(url);
  return new NextRequest(u, {
    headers: { host: u.host },
  });
}

describe("middleware — refreshed auth cookies survive redirects", () => {
  it("carries the rotated token when redirecting a signed-in user off /login", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];

    const res = await middleware(
      req("https://app.escolanautica.app.br/login"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it("carries the rotated token when redirecting an unauth user to /login", async () => {
    mockUser = null;
    refreshedCookies = [{ ...ROTATED, value: "cleared" }];

    const res = await middleware(
      req("https://app.escolanautica.app.br/dashboard"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.cookies.get(ROTATED.name)?.value).toBe("cleared");
  });

  it("redirects a signed-in user with an invite token to /join/<token>", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];

    const res = await middleware(
      req("https://app.escolanautica.app.br/login?invite=abc123"),
    );

    expect(res.headers.get("location")).toContain("/join/abc123");
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it("passes through (no redirect) for a signed-in user on a protected page", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];

    const res = await middleware(
      req("https://app.escolanautica.app.br/dashboard"),
    );

    expect(res.headers.get("location")).toBeNull();
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it("no apex com slug redireciona login para o tenant", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];
    mockProfileAccountId = "acct-1";
    mockAccountSlug = "escola";

    const res = await middleware(
      req("https://app.escolanautica.app.br/login"),
    );

    expect(res.headers.get("location")).toBe(
      "https://escola.escolanautica.app.br/dashboard",
    );
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });
});

describe("middleware — membership no tenant", () => {
  it("usuário de outra escola em /login do tenant vai para /sem-acesso", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];
    mockProfileAccountId = "acct-b";
    mockTenant = {
      id: "acct-a",
      name: "Escola A",
      slug: "escola-a",
      logo_url: null,
    };

    const res = await middleware(
      req("https://escola-a.escolanautica.app.br/login"),
    );

    expect(res.headers.get("location")).toBe(
      "https://escola-a.escolanautica.app.br/sem-acesso",
    );
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it("membro da escola em /login do tenant vai para /dashboard", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];
    mockProfileAccountId = "acct-a";
    mockTenant = {
      id: "acct-a",
      name: "Escola A",
      slug: "escola-a",
      logo_url: null,
    };

    const res = await middleware(
      req("https://escola-a.escolanautica.app.br/login"),
    );

    expect(res.headers.get("location")).toBe(
      "https://escola-a.escolanautica.app.br/dashboard",
    );
  });

  it("usuário de outra escola em rota protegida vai para /sem-acesso", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];
    mockProfileAccountId = "acct-b";
    mockTenant = {
      id: "acct-a",
      name: "Escola A",
      slug: "escola-a",
      logo_url: null,
    };

    const res = await middleware(
      req("https://escola-a.escolanautica.app.br/dashboard"),
    );

    expect(res.headers.get("location")).toBe(
      "https://escola-a.escolanautica.app.br/sem-acesso",
    );
  });
});
