import { describe, expect, it, afterEach } from "vitest";
import {
  getApexUrl,
  getAuthCookieDomain,
  getAuthCookieOptions,
  getDomainBase,
  getTenantUrl,
  isReservedSubdomain,
  parseHost,
} from "./domain";

const ORIGINAL = {
  DOMAIN_BASE: process.env.DOMAIN_BASE,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

afterEach(() => {
  if (ORIGINAL.DOMAIN_BASE === undefined) delete process.env.DOMAIN_BASE;
  else process.env.DOMAIN_BASE = ORIGINAL.DOMAIN_BASE;
  if (ORIGINAL.NEXT_PUBLIC_SITE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL.NEXT_PUBLIC_SITE_URL;
  }
});

describe("domain helpers", () => {
  it("usa DOMAIN_BASE e SITE_URL explícitos", () => {
    process.env.DOMAIN_BASE = "marinner.com.br";
    process.env.NEXT_PUBLIC_SITE_URL = "https://app.marinner.com.br";
    expect(getDomainBase()).toBe("marinner.com.br");
    expect(getApexUrl()).toBe("https://app.marinner.com.br");
    expect(getTenantUrl("escola")).toBe("https://escola.marinner.com.br");
    expect(getTenantUrl("escola", "/inbox")).toBe(
      "https://escola.marinner.com.br/inbox",
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
    process.env.DOMAIN_BASE = "marinner.com.br";
    expect(parseHost("escola.marinner.com.br")).toEqual({
      kind: "tenant",
      slug: "escola",
    });
    expect(parseHost("app.marinner.com.br")).toEqual({ kind: "apex" });
    expect(parseHost("www.marinner.com.br")).toEqual({ kind: "www" });
    expect(parseHost("api.marinner.com.br")).toEqual({
      kind: "reserved",
      sub: "api",
    });
    expect(parseHost("marinner.com.br")).toEqual({ kind: "apex" });
  });

  it("host fora do DOMAIN_BASE vira apex (não inventa slug)", () => {
    process.env.DOMAIN_BASE = "marinner.com.br";
    expect(parseHost("evil.example.com")).toEqual({ kind: "apex" });
  });
});

describe("getAuthCookieDomain / getAuthCookieOptions", () => {
  it("usa .localhost em desenvolvimento local", () => {
    process.env.DOMAIN_BASE = "localhost";
    expect(getAuthCookieDomain()).toBe(".localhost");
  });

  it("usa .DOMAIN_BASE em produção", () => {
    process.env.DOMAIN_BASE = "marinner.com.br";
    expect(getAuthCookieDomain()).toBe(".marinner.com.br");
  });

  it("monta options com sameSite lax", () => {
    process.env.DOMAIN_BASE = "marinner.com.br";
    const opts = getAuthCookieOptions();
    expect(opts.domain).toBe(".marinner.com.br");
    expect(opts.path).toBe("/");
    expect(opts.sameSite).toBe("lax");
    expect(typeof opts.secure).toBe("boolean");
  });
});
