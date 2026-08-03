import { describe, expect, it, afterEach } from "vitest";
import {
  getApexUrl,
  getAuthCookieDomain,
  getAuthCookieOptions,
  canShareAuthAcrossSubdomains,
  getDomainBase,
  getTenantUrl,
  isReservedSubdomain,
  parseHost,
} from "./domain";

const ORIGINAL = {
  DOMAIN_BASE: process.env.DOMAIN_BASE,
  NEXT_PUBLIC_DOMAIN_BASE: process.env.NEXT_PUBLIC_DOMAIN_BASE,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

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

describe("domain helpers", () => {
  it("usa DOMAIN_BASE e SITE_URL explícitos", () => {
    process.env.DOMAIN_BASE = "escolanautica.app.br";
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.escolanautica.app.br";
    expect(getDomainBase()).toBe("escolanautica.app.br");
    expect(getApexUrl()).toBe("https://app.escolanautica.app.br");
    expect(getTenantUrl("escola")).toBe("https://escola.escolanautica.app.br");
    expect(getTenantUrl("escola", "/inbox")).toBe(
      "https://escola.escolanautica.app.br/inbox",
    );
  });

  it("em localhost monta apex e tenant de desenvolvimento", () => {
    process.env.DOMAIN_BASE = "localhost";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getApexUrl()).toBe("http://localhost:3000");
    expect(getTenantUrl("acme")).toBe("http://acme.localhost:3000");
  });

  it("reconhece subdomínios reservados", () => {
    expect(isReservedSubdomain("app")).toBe(true);
    expect(isReservedSubdomain("www")).toBe(true);
    expect(isReservedSubdomain("escola")).toBe(false);
  });
});

describe("parseHost", () => {
  it("trata localhost e 127.0.0.1 como apex", () => {
    process.env.DOMAIN_BASE = "localhost";
    expect(parseHost("localhost")).toEqual({ kind: "apex" });
    expect(parseHost("localhost:3000")).toEqual({ kind: "apex" });
    expect(parseHost("127.0.0.1:3000")).toEqual({ kind: "apex" });
  });

  it("extrai slug em *.localhost", () => {
    process.env.DOMAIN_BASE = "localhost";
    expect(parseHost("escola.localhost:3000")).toEqual({
      kind: "tenant",
      slug: "escola",
    });
    expect(parseHost("app.localhost")).toEqual({ kind: "apex" });
    expect(parseHost("www.localhost")).toEqual({ kind: "www" });
    expect(parseHost("admin.localhost")).toEqual({
      kind: "reserved",
      sub: "admin",
    });
  });

  it("extrai slug em produção", () => {
    process.env.DOMAIN_BASE = "escolanautica.app.br";
    expect(parseHost("escola.escolanautica.app.br")).toEqual({
      kind: "tenant",
      slug: "escola",
    });
    expect(parseHost("app.escolanautica.app.br")).toEqual({ kind: "apex" });
    expect(parseHost("www.escolanautica.app.br")).toEqual({ kind: "www" });
    expect(parseHost("api.escolanautica.app.br")).toEqual({
      kind: "reserved",
      sub: "api",
    });
    expect(parseHost("escolanautica.app.br")).toEqual({ kind: "apex" });
  });

  it("host fora do DOMAIN_BASE vira apex (não inventa slug)", () => {
    process.env.DOMAIN_BASE = "escolanautica.app.br";
    expect(parseHost("evil.example.com")).toEqual({ kind: "apex" });
  });
});

describe("getAuthCookieDomain / getAuthCookieOptions", () => {
  it("omite domain em desenvolvimento local (host-only cookie)", () => {
    process.env.DOMAIN_BASE = "localhost";
    delete process.env.NEXT_PUBLIC_DOMAIN_BASE;
    expect(getAuthCookieDomain()).toBeUndefined();
    expect(getAuthCookieOptions().domain).toBeUndefined();
  });

  it("omite domain quando só NEXT_PUBLIC_DOMAIN_BASE=localhost (browser)", () => {
    delete process.env.DOMAIN_BASE;
    process.env.NEXT_PUBLIC_DOMAIN_BASE = "localhost";
    expect(getAuthCookieDomain()).toBeUndefined();
    expect(getAuthCookieOptions().domain).toBeUndefined();
  });

  it("usa .DOMAIN_BASE em produção", () => {
    process.env.DOMAIN_BASE = "escolanautica.app.br";
    delete process.env.NEXT_PUBLIC_DOMAIN_BASE;
    expect(getAuthCookieDomain()).toBe(".escolanautica.app.br");
  });

  it("monta options com sameSite lax", () => {
    process.env.DOMAIN_BASE = "escolanautica.app.br";
    delete process.env.NEXT_PUBLIC_DOMAIN_BASE;
    const opts = getAuthCookieOptions();
    expect(opts.domain).toBe(".escolanautica.app.br");
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    expect(typeof opts.secure).toBe("boolean");
  });

  it("canShareAuthAcrossSubdomains só com cookie de domínio", () => {
    process.env.DOMAIN_BASE = "localhost";
    delete process.env.NEXT_PUBLIC_DOMAIN_BASE;
    expect(canShareAuthAcrossSubdomains()).toBe(false);
    process.env.DOMAIN_BASE = "escolanautica.app.br";
    expect(canShareAuthAcrossSubdomains()).toBe(true);
  });
});
