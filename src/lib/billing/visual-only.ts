/**
 * Checkout Asaas em modo só visual (sem API / webhook).
 * Ative com NEXT_PUBLIC_BILLING_CHECKOUT_VISUAL_ONLY=true.
 */
export function isBillingCheckoutVisualOnly(): boolean {
  const raw = process.env.NEXT_PUBLIC_BILLING_CHECKOUT_VISUAL_ONLY?.trim();
  return raw === "true" || raw === "1";
}
