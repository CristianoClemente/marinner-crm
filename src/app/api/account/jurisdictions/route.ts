import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import { getEntitlements } from "@/lib/billing/get-entitlements";
import {
  canAddJurisdiction,
  validateJurisdictionCreate,
} from "@/lib/maritime/validate";

const JURISDICTION_SELECT =
  "id, account_id, authority_id, responsible_user_id, email_override, is_default, created_at, updated_at, authority:maritime_authorities(id, sigla, nome, cidade, uf, email), responsible:profiles!account_jurisdictions_responsible_user_id_fkey(user_id, full_name, email)";

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const { data, error } = await supabase
      .from("account_jurisdictions")
      .select(JURISDICTION_SELECT)
      .eq("account_id", accountId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[GET /api/account/jurisdictions]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ jurisdictions: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateJurisdictionCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const entitlements = await getEntitlements(ctx.supabase, ctx.accountId);
    const { count, error: countError } = await ctx.supabase
      .from("account_jurisdictions")
      .select("id", { count: "exact", head: true })
      .eq("account_id", ctx.accountId);

    if (countError) {
      console.error("[POST /api/account/jurisdictions] count", countError);
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    if (!canAddJurisdiction(count ?? 0, entitlements.maxJurisdictions)) {
      return NextResponse.json(
        {
          error:
            "Limite de jurisdições do plano atingido. Faça upgrade para adicionar mais.",
        },
        { status: 403 },
      );
    }

    const { data: member, error: memberError } = await ctx.supabase
      .from("profiles")
      .select("user_id")
      .eq("user_id", parsed.value.responsible_user_id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (memberError) {
      console.error("[POST /api/account/jurisdictions] member", memberError);
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    if (!member) {
      return NextResponse.json(
        { error: "Responsável precisa ser membro da conta." },
        { status: 400 },
      );
    }

    const { data: authority, error: authError } = await ctx.supabase
      .from("maritime_authorities")
      .select("id")
      .eq("id", parsed.value.authority_id)
      .maybeSingle();

    if (authError) {
      console.error("[POST /api/account/jurisdictions] authority", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }
    if (!authority) {
      return NextResponse.json(
        { error: "Jurisdição não encontrada no catálogo." },
        { status: 400 },
      );
    }

    if (parsed.value.is_default) {
      const { error: clearError } = await ctx.supabase
        .from("account_jurisdictions")
        .update({ is_default: false })
        .eq("account_id", ctx.accountId)
        .eq("is_default", true);
      if (clearError) {
        console.error("[POST /api/account/jurisdictions] clear default", clearError);
        return NextResponse.json(
          { error: clearError.message },
          { status: 500 },
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from("account_jurisdictions")
      .insert({
        account_id: ctx.accountId,
        authority_id: parsed.value.authority_id,
        responsible_user_id: parsed.value.responsible_user_id,
        email_override: parsed.value.email_override,
        is_default: parsed.value.is_default,
      })
      .select(JURISDICTION_SELECT)
      .single();

    if (error) {
      console.error("[POST /api/account/jurisdictions]", error);
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json(
        {
          error:
            status === 409
              ? "Esta jurisdição já está vinculada."
              : error.message,
        },
        { status },
      );
    }

    return NextResponse.json({ jurisdiction: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
