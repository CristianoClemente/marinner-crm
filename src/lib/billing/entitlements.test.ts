import { describe, expect, it } from "vitest";
import {
  computeEntitlements,
  formatAsaasDate,
  isPlanCode,
  trialEndsAtFromNow,
  TRIAL_DAYS,
} from "./entitlements";

const samplePlan = {
  id: "p1",
  code: "pro",
  name: "Pro",
  price_cents: 39700,
  currency: "BRL",
  interval: "month",
  max_seats: 10,
  max_contacts: 5000,
  features: { flows: true },
};

describe("computeEntitlements", () => {
  it("permite acesso em trialing e active", () => {
    expect(
      computeEntitlements({ status: "trialing", plan: samplePlan })
        .isAccessAllowed,
    ).toBe(true);
    expect(
      computeEntitlements({ status: "active", plan: samplePlan }).isAccessAllowed,
    ).toBe(true);
  });

  it("bloqueia incomplete / past_due / canceled / null", () => {
    for (const status of ["incomplete", "past_due", "canceled", null] as const) {
      const e = computeEntitlements({ status, plan: samplePlan });
      expect(e.isAccessAllowed).toBe(false);
      expect(e.needsCheckout).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("isPlanCode", () => {
    expect(isPlanCode("starter")).toBe(true);
    expect(isPlanCode("enterprise")).toBe(false);
  });

  it("trialEndsAtFromNow avança TRIAL_DAYS", () => {
    const start = new Date("2026-08-02T12:00:00.000Z");
    const end = trialEndsAtFromNow(start);
    const diffDays = Math.round(
      (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(diffDays).toBe(TRIAL_DAYS);
    expect(formatAsaasDate(end)).toBe("2026-08-16");
  });
});
