import { describe, expect, it } from "vitest";
import {
  mapAsaasPaymentEvent,
  mapAsaasSubscriptionEvent,
} from "./webhook-map";

describe("webhook-map", () => {
  it("PAYMENT_RECEIVED → active", () => {
    expect(mapAsaasPaymentEvent("PAYMENT_RECEIVED")).toBe("active");
    expect(mapAsaasPaymentEvent("PAYMENT_CONFIRMED")).toBe("active");
  });

  it("PAYMENT_OVERDUE → past_due", () => {
    expect(mapAsaasPaymentEvent("PAYMENT_OVERDUE")).toBe("past_due");
  });

  it("SUBSCRIPTION_DELETED → canceled", () => {
    expect(mapAsaasSubscriptionEvent("SUBSCRIPTION_DELETED")).toBe("canceled");
  });

  it("SUBSCRIPTION_CREATED ACTIVE → trialing", () => {
    expect(mapAsaasSubscriptionEvent("SUBSCRIPTION_CREATED", "ACTIVE")).toBe(
      "trialing",
    );
  });
});
