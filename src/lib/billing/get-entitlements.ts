import type { SupabaseClient } from "@supabase/supabase-js";

import {
  computeEntitlements,
  type Entitlements,
} from "@/lib/billing/entitlements";

/**
 * Carrega plano + assinatura da account e devolve entitlements.
 * Usa o client passado (SSR com RLS ou service role).
 */
export async function getEntitlements(
  supabase: SupabaseClient,
  accountId: string,
): Promise<Entitlements> {
  const { data: sub, error } = await supabase
    .from("subscriptions")
    .select(
      "status, trial_ends_at, current_period_end, plan:plans(id, code, name, price_cents, currency, interval, max_seats, max_contacts, features)",
    )
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    console.error("[getEntitlements] subscription fetch:", error.message);
    return computeEntitlements({ status: null, plan: null });
  }

  if (!sub) {
    return computeEntitlements({ status: null, plan: null });
  }

  const planRaw = sub.plan as
    | {
        id: string;
        code: string;
        name: string;
        price_cents: number;
        currency: string;
        interval: string;
        max_seats: number;
        max_contacts: number | null;
        features: Record<string, unknown> | null;
      }
    | {
        id: string;
        code: string;
        name: string;
        price_cents: number;
        currency: string;
        interval: string;
        max_seats: number;
        max_contacts: number | null;
        features: Record<string, unknown> | null;
      }[]
    | null;

  const plan = Array.isArray(planRaw) ? (planRaw[0] ?? null) : planRaw;

  return computeEntitlements({
    status: sub.status,
    trialEndsAt: sub.trial_ends_at,
    currentPeriodEnd: sub.current_period_end,
    plan,
  });
}
