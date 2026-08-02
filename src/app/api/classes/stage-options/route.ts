import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";

/** Etapas com flag Usa turmas, para o seletor ao criar evento na Agenda. */
export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("process_template_stages")
      .select(
        `
        id,
        name,
        template_id,
        accepts_classes,
        template:process_templates(
          id,
          name,
          active,
          catalog_item:catalog_items(id, name)
        )
      `,
      )
      .eq("account_id", ctx.accountId)
      .eq("accepts_classes", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("[GET /api/classes/stage-options]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stages = (data ?? []).filter((row) => {
      const tpl = row.template as { active?: boolean } | null;
      return tpl?.active !== false;
    });

    return NextResponse.json({ stages });
  } catch (err) {
    return toErrorResponse(err);
  }
}
