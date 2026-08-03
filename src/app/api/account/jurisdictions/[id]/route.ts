import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { validateJurisdictionPatch } from "@/lib/maritime/validate";

const JURISDICTION_SELECT =
  "id, account_id, authority_id, responsible_user_id, email_override, is_default, created_at, updated_at, authority:maritime_authorities(id, sigla, nome, cidade, uf, email), responsible:profiles!account_jurisdictions_responsible_user_id_fkey(user_id, full_name, email)";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = validateJurisdictionPatch(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    const { data: existing, error: existingError } = await ctx.supabase
      .from("account_jurisdictions")
      .select("id, authority_id")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (existingError) {
      console.error("[PATCH /api/account/jurisdictions] load", existingError);
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Vínculo não encontrado." },
        { status: 404 },
      );
    }

    if (parsed.value.responsible_user_id) {
      const { data: member, error: memberError } = await ctx.supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", parsed.value.responsible_user_id)
        .eq("account_id", ctx.accountId)
        .maybeSingle();
      if (memberError) {
        console.error("[PATCH /api/account/jurisdictions] member", memberError);
        return NextResponse.json(
          { error: memberError.message },
          { status: 500 },
        );
      }
      if (!member) {
        return NextResponse.json(
          { error: "Responsável precisa ser membro da conta." },
          { status: 400 },
        );
      }
    }

    if (parsed.value.is_default === true) {
      const { error: clearError } = await ctx.supabase
        .from("account_jurisdictions")
        .update({ is_default: false })
        .eq("account_id", ctx.accountId)
        .eq("is_default", true)
        .neq("id", id);
      if (clearError) {
        console.error(
          "[PATCH /api/account/jurisdictions] clear default",
          clearError,
        );
        return NextResponse.json(
          { error: clearError.message },
          { status: 500 },
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from("account_jurisdictions")
      .update(parsed.value)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select(JURISDICTION_SELECT)
      .single();

    if (error) {
      console.error("[PATCH /api/account/jurisdictions]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ jurisdiction: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await context.params;

    const { data: existing, error: existingError } = await ctx.supabase
      .from("account_jurisdictions")
      .select("id, authority_id")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (existingError) {
      console.error("[DELETE /api/account/jurisdictions] load", existingError);
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }
    if (!existing) {
      return NextResponse.json(
        { error: "Vínculo não encontrado." },
        { status: 404 },
      );
    }

    const { count, error: locError } = await ctx.supabase
      .from("class_locations")
      .select("id", { count: "exact", head: true })
      .eq("account_id", ctx.accountId)
      .eq("authority_id", existing.authority_id);

    if (locError) {
      console.error("[DELETE /api/account/jurisdictions] locations", locError);
      return NextResponse.json({ error: locError.message }, { status: 500 });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            "Há locais de aula usando esta jurisdição. Altere os locais antes de remover.",
        },
        { status: 409 },
      );
    }

    const { error } = await ctx.supabase
      .from("account_jurisdictions")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId);

    if (error) {
      console.error("[DELETE /api/account/jurisdictions]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
