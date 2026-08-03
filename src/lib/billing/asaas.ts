/**
 * Cliente HTTP Asaas (sandbox / produção).
 * Docs: https://docs.asaas.com/ — Checkout RECURRENT + subscriptions.
 */

export class AsaasError extends Error {
  readonly status: number;
  readonly asaasCode: string | null;

  constructor(message: string, status: number, asaasCode: string | null = null) {
    super(message);
    this.name = "AsaasError";
    this.status = status;
    this.asaasCode = asaasCode;
  }
}

export type AsaasEnv = "sandbox" | "production";

export type AsaasBillingType = "CREDIT_CARD" | "PIX" | "BOLETO";

export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  addressNumber?: string;
  externalReference?: string;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
}

export interface AsaasCheckoutItem {
  name: string;
  description?: string;
  quantity: number;
  value: number;
}

export interface AsaasCheckoutInput {
  billingTypes: AsaasBillingType[];
  chargeTypes: Array<"DETACHED" | "RECURRENT" | "INSTALLMENT">;
  minutesToExpire?: number;
  callback: {
    successUrl: string;
    cancelUrl: string;
    expiredUrl: string;
  };
  items: AsaasCheckoutItem[];
  customerData?: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone?: string;
    postalCode?: string;
    addressNumber?: string;
    address?: string;
    province?: string;
    city?: number;
  };
  customer?: string;
  subscription?: {
    cycle: "MONTHLY" | "WEEKLY" | "YEARLY" | "QUARTERLY" | "SEMIANNUALLY" | "BIWEEKLY";
    nextDueDate: string;
    endDate?: string;
  };
  externalReference?: string;
}

export interface AsaasCheckout {
  id: string;
  /** URL pública do checkout hospedado (campo varia na API). */
  url?: string;
  link?: string;
}

export interface AsaasSubscription {
  id: string;
  customer: string;
  status: string;
  value: number;
  cycle: string;
  nextDueDate?: string;
  externalReference?: string | null;
}

function getEnv(): AsaasEnv {
  const raw = (process.env.ASAAS_ENV ?? "sandbox").trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

function getBaseUrl(): string {
  return getEnv() === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY?.trim();
  if (!key) {
    throw new AsaasError("ASAAS_API_KEY não configurada", 500);
  }
  return key;
}

const REQUEST_TIMEOUT_MS = 60_000;

async function asaasFetch<T>(
  path: string,
  init: RequestInit & { method?: string } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        access_token: getApiKey(),
        ...(init.headers ?? {}),
      },
    });

    const body = (await res.json().catch(() => null)) as
      | {
          errors?: Array<{ code?: string; description?: string }>;
          message?: string;
        }
      | T
      | null;

    if (!res.ok) {
      const errObj = body as {
        errors?: Array<{ code?: string; description?: string }>;
        message?: string;
      } | null;
      const first = errObj?.errors?.[0];
      const friendly =
        first?.description ||
        errObj?.message ||
        "Falha na comunicação com o Asaas. Tente novamente.";
      throw new AsaasError(friendly, res.status, first?.code ?? null);
    }

    return body as T;
  } catch (err) {
    if (err instanceof AsaasError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new AsaasError(
        "Tempo esgotado ao falar com o Asaas. Tente novamente.",
        504,
      );
    }
    throw new AsaasError(
      "Não foi possível alcançar o Asaas. Verifique a conexão.",
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function createCustomer(
  input: AsaasCustomerInput,
): Promise<AsaasCustomer> {
  return asaasFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function createCheckout(
  input: AsaasCheckoutInput,
): Promise<AsaasCheckout> {
  return asaasFetch<AsaasCheckout>("/checkouts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Resolve a URL pública do checkout a partir da resposta Asaas. */
export function resolveCheckoutUrl(checkout: AsaasCheckout): string | null {
  const direct = checkout.url || checkout.link;
  if (direct) return direct;
  const id = checkout.id;
  if (!id) return null;
  const env = getEnv();
  // Fallback documentado pelo Asaas: página hospedada por id
  return env === "production"
    ? `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(id)}`
    : `https://sandbox.asaas.com/checkoutSession/show?id=${encodeURIComponent(id)}`;
}

export async function getSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
  );
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription> {
  return asaasFetch<AsaasSubscription>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "DELETE" },
  );
}

export function centsToAsaasValue(cents: number): number {
  return Math.round(cents) / 100;
}
