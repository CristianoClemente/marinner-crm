import { NextResponse } from "next/server";

import type { SubscriptionStatus } from "@/lib/billing/entitlements";
import {
  mapAsaasPaymentEvent,
  mapAsaasSubscriptionEvent,
} from "@/lib/billing/webhook-map";
import { supabaseAdmin } from "@/lib/flows/admin-client";

type AsaasWebhookBody = {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    subscription?: string | null;
    externalReference?: string | null;
    status?: string;
  };
  subscription?: {
    id?: string;
    externalReference?: string | null;
    status?: string;
    customer?: string;
  };
  checkout?: {
    id?: string;
    externalReference?: string | null;
    status?: string;
  };
};

async function findSubscriptionId(body: AsaasWebhookBody): Promise<string | null> {
  const admin = supabaseAdmin();
  const ext =
    body.payment?.externalReference ||
    body.subscription?.externalReference ||
    body.checkout?.externalReference ||
    null;

  if (ext) {
    const byId = await admin
      .from("subscriptions")
      .select("id")
      .eq("id", ext)
      .maybeSingle();
    if (byId.data?.id) return byId.data.id;

    const byAccount = await admin
      .from("subscriptions")
      .select("id")
      .eq("account_id", ext)
      .maybeSingle();
    if (byAccount.data?.id) return byAccount.data.id;

    const byRef = await admin
      .from("subscriptions")
      .select("id")
      .eq("external_reference", ext)
      .maybeSingle();
    if (byRef.data?.id) return byRef.data.id;
  }

  const asaasSubId = body.payment?.subscription || body.subscription?.id;
  if (asaasSubId) {
    const { data } = await admin
      .from("subscriptions")
      .select("id")
      .eq("asaas_subscription_id", asaasSubId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  const checkoutId = body.checkout?.id;
  if (checkoutId) {
    const { data } = await admin
      .from("subscriptions")
      .select("id")
      .eq("asaas_checkout_id", checkoutId)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return null;
}

/**
 * POST /api/webhooks/asaas
 * Valida asaas-access-token, idempotência por event.id, atualiza subscription.
 */
export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!expected) {
    console.error("[webhooks/asaas] ASAAS_WEBHOOK_TOKEN missing");
    return NextResponse.json({ error: "Misconfigured" }, { status: 500 });
  }

  const token = request.headers.get("asaas-access-token")?.trim();
  if (!token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AsaasWebhookBody | null;
  if (!body || typeof body.event !== "string") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const eventId =
    typeof body.id === "string" && body.id.length > 0
      ? body.id
      : `${body.event}:${body.payment?.id ?? body.subscription?.id ?? body.checkout?.id ?? "unknown"}`;

  const admin = supabaseAdmin();

  const { error: insertErr } = await admin.from("billing_events").insert({
    asaas_event_id: eventId,
    event: body.event,
    payload: body,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[webhooks/asaas] persist event:", insertErr.message);
    return NextResponse.json({ error: "Persist failed" }, { status: 500 });
  }

  const subscriptionId = await findSubscriptionId(body);
  let nextStatus: SubscriptionStatus | null =
    mapAsaasPaymentEvent(body.event) ??
    mapAsaasSubscriptionEvent(body.event, body.subscription?.status);

  if (
    !nextStatus &&
    (body.event === "CHECKOUT_PAID" ||
      body.event === "CHECKOUT_DONE" ||
      body.event.startsWith("CHECKOUT_"))
  ) {
    const st = (body.checkout?.status ?? "").toUpperCase();
    if (st.includes("PAID") || st.includes("DONE") || st === "FINISHED") {
      nextStatus = "trialing";
    }
  }

  if (subscriptionId) {
    await admin
      .from("billing_events")
      .update({ subscription_id: subscriptionId })
      .eq("asaas_event_id", eventId);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (nextStatus) patch.status = nextStatus;
    if (body.subscription?.id) {
      patch.asaas_subscription_id = body.subscription.id;
    } else if (body.payment?.subscription) {
      patch.asaas_subscription_id = body.payment.subscription;
    }
    if (body.subscription?.customer) {
      patch.asaas_customer_id = body.subscription.customer;
    }
    if (body.checkout?.id) {
      patch.asaas_checkout_id = body.checkout.id;
    }

    if (Object.keys(patch).length > 1) {
      const { error: updErr } = await admin
        .from("subscriptions")
        .update(patch)
        .eq("id", subscriptionId);
      if (updErr) {
        console.error("[webhooks/asaas] update sub:", updErr.message);
      }
    }
  } else {
    console.error("[webhooks/asaas] subscription not found for event", {
      event: body.event,
      eventId,
    });
  }

  return NextResponse.json({ received: true });
}
