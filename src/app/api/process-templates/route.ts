import { NextResponse } from "next/server";

import {
  getCurrentAccount,
  requireRole,
  toErrorResponse,
} from "@/lib/auth/account";
import {
  validateTemplateCreate,
  requireActiveCatalogService,
} from "@/lib/processes/validate";

export async function GET(request: Request) {
  try {
    const { supabase, accountId } = await getCurrentAccount();
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active") === "1";

    let query = supabase
      .from("process_templates")
      .select(
        "*, stages:process_template_stages(*), catalog_item:catalog_items(id, name)",
      )
      .eq("account_id", accountId)
      .order("name", { ascending: true });

    if (activeOnly) query = query.eq("active", true);

    const { data, error } = await query;
    if (error) {
      console.error("[GET /api/process-templates]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const templates = (data ?? []).map((row) => {
      const stages = Array.isArray(row.stages)
        ? [...row.stages].sort(
            (a: { position: number }, b: { position: number }) =>
              a.position - b.position,
          )
        : [];
      return { ...row, stages };
    });

    return NextResponse.json({ templates });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = await request.json().catch(() => null);
    const parsed = validateTemplateCreate(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }

    if (parsed.value.catalog_item_id) {
      const service = await requireActiveCatalogService(
        ctx.supabase,
        ctx.accountId,
        parsed.value.catalog_item_id,
      );
      if (!service.ok) {
        return NextResponse.json(
          { error: service.message },
          { status: service.status },
        );
      }
    }

    const { data, error } = await ctx.supabase
      .from("process_templates")
      .insert({
        account_id: ctx.accountId,
        ...parsed.value,
      })
      .select(
        "*, stages:process_template_stages(*), catalog_item:catalog_items(id, name)",
      )
      .single();

    if (error) {
      console.error("[POST /api/process-templates]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
