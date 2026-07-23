import { describe, expect, it, afterEach } from "vitest";
import {
  getApexUrl,
  getDomainBase,
  getTenantUrl,
  isReservedSubdomain,
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
