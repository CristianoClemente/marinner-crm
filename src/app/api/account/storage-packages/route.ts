import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { GIB } from "@/lib/storage/chat-quota";

type Body = {
  extra_gb?: unknown;
  label?: unknown;
  ends_at?: unknown;
  notes?: unknown;
};

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = (await request.json().catch(() => null)) as Body | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    const gb = typeof body.extra_gb === "number" ? body.extra_gb : Number(body.extra_gb);
    if (!Number.isFinite(gb) || gb <= 0 || gb > 1024) {
      return NextResponse.json(
        { error: "Informe extra_gb entre 1 e 1024." },
        { status: 400 },
      );
    }

    const extraBytes = Math.round(gb * GIB);
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 80)
        : `+${gb} GB`;

    let endsAt: string | null = null;
    if (body.ends_at != null && body.ends_at !== "") {
      if (typeof body.ends_at !== "string") {
        return NextResponse.json(
          { error: "ends_at inválido." },
          { status: 400 },
        );
      }
      const d = new Date(body.ends_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { error: "ends_at inválido." },
          { status: 400 },
        );
      }
      endsAt = d.toISOString();
    }

    const notes =
      typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;

    const { data, error } = await ctx.supabase
      .from("account_storage_packages")
      .insert({
        account_id: ctx.accountId,
        extra_bytes: extraBytes,
        label,
        ends_at: endsAt,
        notes: notes || null,
        created_by_user_id: ctx.userId,
        status: "active",
      })
      .select(
        "id, label, extra_bytes, starts_at, ends_at, status, notes, created_at",
      )
      .single();

    if (error) {
      console.error("[storage-packages] insert:", error);
      return NextResponse.json(
        { error: "Falha ao criar pacote." },
        { status: 500 },
      );
    }

    return NextResponse.json({ package: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
