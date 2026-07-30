import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";

type Body = {
  status?: unknown;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await requireRole("admin");
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body || body.status !== "canceled") {
      return NextResponse.json(
        { error: "Apenas status=canceled é suportado." },
        { status: 400 },
      );
    }

    const { data, error } = await ctx.supabase
      .from("account_storage_packages")
      .update({ status: "canceled" })
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select(
        "id, label, extra_bytes, starts_at, ends_at, status, notes, created_at",
      )
      .maybeSingle();

    if (error) {
      console.error("[storage-packages] cancel:", error);
      return NextResponse.json(
        { error: "Falha ao cancelar pacote." },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Pacote não encontrado." },
        { status: 404 },
      );
    }

    return NextResponse.json({ package: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}
