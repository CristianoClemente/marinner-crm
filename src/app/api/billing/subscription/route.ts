import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  toErrorResponse,
} from "@/lib/auth/account";
import { getEntitlements } from "@/lib/billing/get-entitlements";

/** GET /api/billing/subscription — entitlements da account atual. */
export async function GET() {
  try {
    const ctx = await getCurrentAccount();
    const entitlements = await getEntitlements(ctx.supabase, ctx.accountId);

    const { data: sub } = await ctx.supabase
      .from("subscriptions")
      .select(
        "id, status, trial_ends_at, current_period_end, asaas_subscription_id, asaas_checkout_id, cancel_at_period_end",
      )
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    return NextResponse.json({
      entitlements,
      subscription: sub,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
