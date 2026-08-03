import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolvePostLoginNavigation } from "./post-login";

const ORIGINAL = {
  DOMAIN_BASE: process.env.DOMAIN_BASE,
  NEXT_PUBLIC_DOMAIN_BASE: process.env.NEXT_PUBLIC_DOMAIN_BASE,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

beforeEach(() => {
  process.env.DOMAIN_BASE = "escolanautica.app.br";
  process.env.NEXT_PUBLIC_DOMAIN_BASE = "escolanautica.app.br";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.escolanautica.app.br";
});

afterEach(() => {
  if (ORIGINAL.DOMAIN_BASE === undefined) delete process.env.DOMAIN_BASE;
  else process.env.DOMAIN_BASE = ORIGINAL.DOMAIN_BASE;
  if (ORIGINAL.NEXT_PUBLIC_DOMAIN_BASE === undefined) {
    delete process.env.NEXT_PUBLIC_DOMAIN_BASE;
  } else {
    process.env.NEXT_PUBLIC_DOMAIN_BASE = ORIGINAL.NEXT_PUBLIC_DOMAIN_BASE;
  }
  if (ORIGINAL.NEXT_PUBLIC_SITE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.NEXT_PUBLIC_SITE_URL;
  }
});

describe("resolvePostLoginNavigation", () => {
  it("com invite vai para /join", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: "abc",
        host: "escola-a.escolanautica.app.br",
        account: { id: "1", slug: "escola-b" },
        hostAccountId: "acct-a",
      }),
    ).toEqual({ kind: "path", href: "/join/abc" });
  });

  it("no tenant certo (por accountId) vai para /dashboard", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: null,
        host: "escola-a.escolanautica.app.br",
        account: { id: "acct-a", slug: "escola-a" },
        hostAccountId: "acct-a",
      }),
    ).toEqual({ kind: "path", href: "/dashboard" });
  });

  it("no tenant errado (por accountId) bloqueia", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: null,
        host: "escola-a.escolanautica.app.br",
        account: { id: "acct-b", slug: "escola-b" },
        hostAccountId: "acct-a",
      }),
    ).toEqual({ kind: "sem-acesso" });
  });

  it("sem account (fetch falhou) não bloqueia — deixa o middleware", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: null,
        host: "escola-a.escolanautica.app.br",
        account: null,
        hostAccountId: "acct-a",
      }),
    ).toEqual({ kind: "path", href: "/dashboard" });
  });

  it("sem hostAccountId compara por slug", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: null,
        host: "escola-a.escolanautica.app.br",
        account: { id: "1", slug: "escola-b" },
      }),
    ).toEqual({ kind: "sem-acesso" });
  });

  it("no apex com slug redireciona para o tenant", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: null,
        host: "app.escolanautica.app.br",
        account: { id: "1", slug: "escola-a" },
        canShareAuth: true,
      }),
    ).toEqual({
      kind: "path",
      href: "https://escola-a.escolanautica.app.br/dashboard",
    });
  });

  it("no apex sem share fica no /dashboard", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: null,
        host: "app.escolanautica.app.br",
        account: { id: "1", slug: "escola-a" },
        canShareAuth: false,
      }),
    ).toEqual({ kind: "path", href: "/dashboard" });
  });

  it("no apex sem slug fica no /dashboard", () => {
    expect(
      resolvePostLoginNavigation({
        inviteToken: null,
        host: "app.escolanautica.app.br",
        account: { id: "1", slug: null },
        canShareAuth: true,
      }),
    ).toEqual({ kind: "path", href: "/dashboard" });
  });
});
