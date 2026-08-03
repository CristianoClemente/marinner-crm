import { NextResponse } from "next/server";

import {
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import {
  AsaasError,
  centsToAsaasValue,
  createCheckout,
  createCustomer,
  resolveCheckoutUrl,
} from "@/lib/billing/asaas";
import { digitsOnly, isValidCpfCnpj } from "@/lib/billing/cpf-cnpj";
import {
  formatAsaasDate,
  isPlanCode,
  trialEndsAtFromNow,
} from "@/lib/billing/entitlements";
import { getApexUrl } from "@/lib/domain";
import { supabaseAdmin } from "@/lib/flows/admin-client";
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "@/lib/rate-limit";

type Body = {
  planCode?: unknown;
  cpfCnpj?: unknown;
  phone?: unknown;
  postalCode?: unknown;
  addressNumber?: unknown;
};

function callbackUrls(): {
  successUrl: string;
  cancelUrl: string;
  expiredUrl: string;
} {
  const apex = getApexUrl();
  const successPath =
    process.env.ASAAS_CHECKOUT_SUCCESS_PATH?.trim() ||
    "/dashboard?billing=ok";
  const cancelPath =
    process.env.ASAAS_CHECKOUT_CANCEL_PATH?.trim() ||
    "/billing/checkout?resume=1";
  const join = (path: string) =>
    `${apex}${path.startsWith("/") ? path : `/${path}`}`;
  return {
    successUrl: join(successPath),
    cancelUrl: join(cancelPath),
    expiredUrl: join(cancelPath),
  };
}

/** POST /api/billing/checkout — cria/atualiza subscription e Checkout Asaas. */
export async function POST(request: Request) {
  try {
    const ctx = await requireRole("owner");
    const limit = checkRateLimit(
      `billing:checkout:${ctx.userId}`,
      RATE_LIMITS.adminAction,
    );
    if (!limit.success) return rateLimitResponse(limit);

    const body = (await request.json().catch(() => null)) as Body | null;
    const planCode =
      typeof body?.planCode === "string" ? body.planCode.trim() : "";
    const cpfCnpjRaw =
      typeof body?.cpfCnpj === "string" ? body.cpfCnpj : "";
    const phone = typeof body?.phone === "string" ? digitsOnly(body.phone) : "";
    const postalCode =
      typeof body?.postalCode === "string"
        ? digitsOnly(body.postalCode)
        : "";
    const addressNumber =
      typeof body?.addressNumber === "string"
        ? body.addressNumber.trim()
        : "";

    if (!isPlanCode(planCode)) {
      return NextResponse.json(
        { error: "Plano inválido" },
        { status: 400 },
      );
    }
    if (!isValidCpfCnpj(cpfCnpjRaw)) {
      return NextResponse.json(
        { error: "CPF ou CNPJ inválido" },
        { status: 400 },
      );
    }
    if (phone.length < 10) {
      return NextResponse.json(
        { error: "Informe um telefone válido com DDD" },
        { status: 400 },
      );
    }
    if (postalCode.length !== 8) {
      return NextResponse.json(
        { error: "CEP inválido" },
        { status: 400 },
      );
    }
    if (!addressNumber) {
      return NextResponse.json(
        { error: "Informe o número do endereço" },
        { status: 400 },
      );
    }

    const cpfCnpj = digitsOnly(cpfCnpjRaw);
    const admin = supabaseAdmin();

    const { data: plan, error: planErr } = await admin
      .from("plans")
      .select("id, code, name, price_cents, currency, is_active")
      .eq("code", planCode)
      .eq("is_active", true)
      .maybeSingle();

    if (planErr || !plan) {
      return NextResponse.json(
        { error: "Plano não encontrado" },
        { status: 404 },
      );
    }

    const {
      data: { user },
    } = await ctx.supabase.auth.getUser();
    const email = user?.email;
    if (!email) {
      return NextResponse.json(
        { error: "Usuário sem e-mail" },
        { status: 400 },
      );
    }

    const trialEnd = trialEndsAtFromNow();
    const nextDueDate = formatAsaasDate(trialEnd);

    const { data: existing } = await admin
      .from("subscriptions")
      .select("id, asaas_customer_id, status")
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    let subscriptionId = existing?.id as string | undefined;
    let asaasCustomerId = existing?.asaas_customer_id as string | null | undefined;

    if (!asaasCustomerId) {
      const customer = await createCustomer({
        name: ctx.account.name,
        email,
        cpfCnpj,
        phone,
        mobilePhone: phone,
        postalCode,
        addressNumber,
        externalReference: ctx.accountId,
      });
      asaasCustomerId = customer.id;
    }

    const billingPatch = {
      plan_id: plan.id,
      status: "incomplete" as const,
      asaas_customer_id: asaasCustomerId,
      trial_ends_at: trialEnd.toISOString(),
      billing_cpf_cnpj: cpfCnpj,
      billing_phone: phone,
      billing_postal_code: postalCode,
      billing_address_number: addressNumber,
      updated_at: new Date().toISOString(),
      external_reference: ctx.accountId,
    };

    if (subscriptionId) {
      const { error: updErr } = await admin
        .from("subscriptions")
        .update(billingPatch)
        .eq("id", subscriptionId);
      if (updErr) {
        console.error("[billing/checkout] update sub:", updErr.message);
        return NextResponse.json(
          { error: "Não foi possível atualizar a assinatura" },
          { status: 500 },
        );
      }
    } else {
      const { data: created, error: insErr } = await admin
        .from("subscriptions")
        .insert({
          account_id: ctx.accountId,
          ...billingPatch,
        })
        .select("id")
        .single();
      if (insErr || !created) {
        console.error("[billing/checkout] insert sub:", insErr?.message);
        return NextResponse.json(
          { error: "Não foi possível criar a assinatura" },
          { status: 500 },
        );
      }
      subscriptionId = created.id;
    }

    const callbacks = callbackUrls();
    const checkout = await createCheckout({
      billingTypes: ["CREDIT_CARD", "PIX", "BOLETO"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 120,
      callback: callbacks,
      customer: asaasCustomerId ?? undefined,
      customerData: {
        name: ctx.account.name,
        email,
        cpfCnpj,
        phone,
        postalCode,
        addressNumber,
      },
      items: [
        {
          name: `Marinner ${plan.name}`,
          description: `Plano ${plan.name} — mensalidade`,
          quantity: 1,
          value: centsToAsaasValue(plan.price_cents),
        },
      ],
      subscription: {
        cycle: "MONTHLY",
        nextDueDate,
      },
      externalReference: subscriptionId,
    });

    const url = resolveCheckoutUrl(checkout);
    if (!url) {
      return NextResponse.json(
        { error: "Checkout criado sem URL. Tente novamente." },
        { status: 502 },
      );
    }

    await admin
      .from("subscriptions")
      .update({
        asaas_checkout_id: checkout.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId!);

    return NextResponse.json({
      checkoutUrl: url,
      checkoutId: checkout.id,
      subscriptionId,
      trialEndsAt: trialEnd.toISOString(),
    });
  } catch (err) {
    if (err instanceof AsaasError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status >= 400 && err.status < 600 ? err.status : 502 },
      );
    }
    return toErrorResponse(err);
  }
}
