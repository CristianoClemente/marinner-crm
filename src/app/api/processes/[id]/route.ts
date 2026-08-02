import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid } from "@/lib/processes/validate";

type Ctx = { params: Promise<{ id: string }> };

const PROCESS_SELECT =
  "*, template:process_templates(id, name, catalog_item_id, active), current_stage:process_template_stages!enrollment_processes_current_stage_id_fkey(*), contact:contacts(id, name, phone, cpf)";

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
