import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isCommercialStatus } from "@/lib/processes/advance";
import { PROCESS_SELECT } from "@/lib/processes/process-select";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("enrollment_processes")
      .select(PROCESS_SELECT)
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[GET /api/processes/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Processo não encontrado." },
        { status: 404 },
      );
    }

    const { data: history } = await ctx.supabase
      .from("process_stage_history")
      .select("*")
      .eq("process_id", id)
      .order("created_at", { ascending: false });

    const { data: stages } = await ctx.supabase
      .from("process_template_stages")
      .select("*")
      .eq("template_id", data.template_id)
      .order("position", { ascending: true });

    return NextResponse.json({
      process: data,
      history: history ?? [],
      stages: stages ?? [],
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("agent");
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const { data: process, error: pErr } = await ctx.supabase
      .from("enrollment_processes")
      .select("*, template:process_templates(has_monetary_value, has_commercial_outcome)")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();
    if (pErr || !process) {
      return NextResponse.json(
        { error: "Processo não encontrado." },
        { status: 404 },
      );
    }

    const template = process.template as {
      has_monetary_value?: boolean;
      has_commercial_outcome?: boolean;
    } | null;
    const patch: Record<string, unknown> = {};

    if ("title" in body) {
      if (body.title === null || body.title === "") {
        patch.title = null;
      } else if (typeof body.title === "string") {
        patch.title = body.title.trim().slice(0, 200);
      } else {
        return NextResponse.json({ error: "Título inválido." }, { status: 400 });
      }
    }
    if ("value" in body) {
      if (!template?.has_monetary_value) {
        return NextResponse.json(
          { error: "Este funil não usa valor monetário." },
          { status: 400 },
        );
      }
      const n = typeof body.value === "number" ? body.value : Number(body.value);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Valor inválido." }, { status: 400 });
      }
      patch.value = n;
    }
    if ("currency" in body) {
      if (!template?.has_monetary_value) {
        return NextResponse.json(
          { error: "Este funil não usa valor monetário." },
          { status: 400 },
        );
      }
      patch.currency =
        typeof body.currency === "string" && body.currency.trim()
          ? body.currency.trim().slice(0, 8).toUpperCase()
          : null;
    }
    if ("assigned_to" in body) {
      if (body.assigned_to === null || body.assigned_to === "") {
        patch.assigned_to = null;
      } else if (isUuid(body.assigned_to)) {
        patch.assigned_to = body.assigned_to;
      } else {
        return NextResponse.json(
          { error: "Responsável inválido." },
          { status: 400 },
        );
      }
    }
    if ("expected_close_date" in body) {
      if (body.expected_close_date === null || body.expected_close_date === "") {
        patch.expected_close_date = null;
      } else if (typeof body.expected_close_date === "string") {
        patch.expected_close_date = body.expected_close_date.slice(0, 10);
      } else {
        return NextResponse.json(
          { error: "Data de fechamento inválida." },
          { status: 400 },
        );
      }
    }
    if ("commercial_status" in body) {
      if (!template?.has_commercial_outcome) {
        return NextResponse.json(
          { error: "Este funil não usa outcome comercial." },
          { status: 400 },
        );
      }
      if (
        typeof body.commercial_status !== "string" ||
        !isCommercialStatus(body.commercial_status)
      ) {
        return NextResponse.json(
          { error: "Status comercial inválido." },
          { status: 400 },
        );
      }
      patch.commercial_status = body.commercial_status;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: "Nada para atualizar." },
        { status: 400 },
      );
    }

    const { data: updated, error } = await ctx.supabase
      .from("enrollment_processes")
      .update(patch)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select(PROCESS_SELECT)
      .maybeSingle();
    if (error) {
      console.error("[PATCH /api/processes/id]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ process: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
