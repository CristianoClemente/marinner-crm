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

vi.mock("@/lib/tenant/lookup", () => ({
  lookupTenantBySlug: vi.fn(async () => null),
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
  process.env.DOMAIN_BASE = "marinner.com.br";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.marinner.com.br";
  mockUser = null;
  refreshedCookies = [];
  mockProfileAccountId = null;
  mockAccountSlug = null;
});

afterEach(() => vi.clearAllMocks());

const ROTATED = {
  name: "sb-test-auth-token",
  value: "rotated-refresh-token",
  options: { path: "/", httpOnly: true },
};

describe("middleware — refreshed auth cookies survive redirects", () => {
  it("carries the rotated token when redirecting a signed-in user off /login", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];

    const res = await middleware(
      new NextRequest("https://app.marinner.com.br/login"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/dashboard");
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it("carries the rotated token when redirecting an unauth user to /login", async () => {
    mockUser = null;
    refreshedCookies = [{ ...ROTATED, value: "cleared" }];

    const res = await middleware(
      new NextRequest("https://app.marinner.com.br/dashboard"),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
    expect(res.cookies.get(ROTATED.name)?.value).toBe("cleared");
  });

  it("redirects a signed-in user with an invite token to /join/<token>", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];

    const res = await middleware(
      new NextRequest("https://app.marinner.com.br/login?invite=abc123"),
    );

    expect(res.headers.get("location")).toContain("/join/abc123");
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });

  it("passes through (no redirect) for a signed-in user on a protected page", async () => {
    mockUser = { id: "user-1" };
    refreshedCookies = [ROTATED];

    const res = await middleware(
      new NextRequest("https://app.marinner.com.br/dashboard"),
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
      new NextRequest("https://app.marinner.com.br/login"),
    );

    expect(res.headers.get("location")).toBe(
      "https://escola.marinner.com.br/dashboard",
    );
    expect(res.cookies.get(ROTATED.name)?.value).toBe(ROTATED.value);
  });
});
