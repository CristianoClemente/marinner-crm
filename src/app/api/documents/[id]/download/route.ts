import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { isUuid } from "@/lib/processes/validate";
import { resolveR2Target } from "@/lib/storage/bucket-map";
import { publicUrlFor } from "@/lib/storage/r2";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("generated_documents")
      .select("id, file_name, storage_path")
      .eq("account_id", ctx.accountId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("[GET /api/documents/id/download]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
    }

    const target = resolveR2Target("process-docs");
    const url = publicUrlFor(target.publicBaseUrl, data.storage_path);
    return NextResponse.json({
      url,
      file_name: data.file_name,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
