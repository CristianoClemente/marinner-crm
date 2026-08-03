/**
 * Processamento puro de eventos Asaas → status local (testável).
 */

import type { SubscriptionStatus } from "@/lib/billing/entitlements";

export function mapAsaasPaymentEvent(
  event: string,
): SubscriptionStatus | null {
  switch (event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
    case "PAYMENT_APPROVED_BY_RISK_ANALYSIS":
      return "active";
    case "PAYMENT_OVERDUE":
    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED":
    case "PAYMENT_CHARGEBACK_DISPUTE":
      return "past_due";
    default:
      return null;
  }
}

export function mapAsaasSubscriptionEvent(
  event: string,
  asaasStatus?: string,
): SubscriptionStatus | null {
  if (
    event === "SUBSCRIPTION_DELETED" ||
    event === "SUBSCRIPTION_INACTIVATED"
  ) {
    return "canceled";
  }
  if (event === "SUBSCRIPTION_CREATED" || event === "SUBSCRIPTION_UPDATED") {
    const s = (asaasStatus ?? "").toUpperCase();
    if (s === "ACTIVE") return "trialing";
    if (s === "INACTIVE" || s === "EXPIRED") return "canceled";
  }
  return null;
}
