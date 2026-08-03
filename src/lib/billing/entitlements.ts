/**
 * Entitlements de billing — plano + status da assinatura da account.
 * Leitura via cliente SSR (RLS); writes ficam no service role / webhooks.
 */

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type PlanCode = "starter" | "pro" | "business";

export interface PlanSummary {
  id: string;
  code: PlanCode | string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  maxSeats: number;
  maxContacts: number | null;
  features: Record<string, unknown>;
}

export interface Entitlements {
  status: SubscriptionStatus | null;
  plan: PlanSummary | null;
  maxSeats: number;
  /**
   * Limite de jurisdições OM/STA vinculadas.
   * `null` = ilimitado (Business). Key ausente em features → 1 (seguro).
   */
  maxJurisdictions: number | null;
  features: Record<string, unknown>;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  /** Conta pode usar o app (trial ou paga em dia). */
  isAccessAllowed: boolean;
  /** Precisa ir ao checkout / retomar pagamento. */
  needsCheckout: boolean;
}

export const ACCESS_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  "trialing",
  "active",
]);

export function isPlanCode(value: string): value is PlanCode {
  return value === "starter" || value === "pro" || value === "business";
}

export function computeEntitlements(input: {
  status: string | null | undefined;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
  plan?: {
    id: string;
    code: string;
    name: string;
    price_cents: number;
    currency: string;
    interval: string;
    max_seats: number;
    max_contacts: number | null;
    features: Record<string, unknown> | null;
  } | null;
}): Entitlements {
  const status = normalizeStatus(input.status);
  const plan = input.plan
    ? {
        id: input.plan.id,
        code: input.plan.code,
        name: input.plan.name,
        priceCents: input.plan.price_cents,
        currency: input.plan.currency,
        interval: input.plan.interval,
        maxSeats: input.plan.max_seats,
        maxContacts: input.plan.max_contacts,
        features: input.plan.features ?? {},
      }
    : null;

  const isAccessAllowed = status !== null && ACCESS_STATUSES.has(status);
  const needsCheckout =
    status === null ||
    status === "incomplete" ||
    status === "past_due" ||
    status === "canceled";

  const features = plan?.features ?? {};

  return {
    status,
    plan,
    maxSeats: plan?.maxSeats ?? 0,
    maxJurisdictions: parseMaxJurisdictions(features),
    features,
    trialEndsAt: input.trialEndsAt ?? null,
    currentPeriodEnd: input.currentPeriodEnd ?? null,
    isAccessAllowed,
    needsCheckout,
  };
}

/** Lê `features.max_jurisdictions`. Ausente → 1; `null` → ilimitado. */
export function parseMaxJurisdictions(
  features: Record<string, unknown>,
): number | null {
  if (!Object.prototype.hasOwnProperty.call(features, "max_jurisdictions")) {
    return 1;
  }
  const raw = features.max_jurisdictions;
  if (raw === null) return null;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 1) {
    return Math.floor(raw);
  }
  return 1;
}

function normalizeStatus(
  value: string | null | undefined,
): SubscriptionStatus | null {
  if (
    value === "incomplete" ||
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled"
  ) {
    return value;
  }
  return null;
}

/** Dias de trial padrão (plano comercial). */
export const TRIAL_DAYS = 14;

export function trialEndsAtFromNow(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + TRIAL_DAYS);
  return d;
}

/** YYYY-MM-DD para nextDueDate do Asaas. */
export function formatAsaasDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
