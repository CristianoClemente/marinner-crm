import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  assertPathAllowed,
  isLogicalBucket,
  minRoleForBucket,
  resolveR2Target,
  storageDriver,
  supabaseBucketFor,
  type LogicalBucket,
} from "@/lib/storage/bucket-map";
import { deleteR2Object } from "@/lib/storage/r2";

export const runtime = "nodejs";

type DeleteBody = {
  bucket?: unknown;
  path?: unknown;
};

export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as DeleteBody | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body inválido." }, { status: 400 });
    }

    if (typeof body.bucket !== "string" || !isLogicalBucket(body.bucket)) {
      return NextResponse.json(
        { error: "Bucket de storage inválido." },
        { status: 400 },
      );
    }
    const logicalBucket = body.bucket as LogicalBucket;

    if (typeof body.path !== "string" || !body.path.trim()) {
      return NextResponse.json(
        { error: "Path é obrigatório." },
        { status: 400 },
      );
    }
    const path = body.path.trim().replace(/^\/+/, "");

    const ctx = await requireRole(minRoleForBucket(logicalBucket));

    try {
      assertPathAllowed({
        logicalBucket,
        path,
        accountId: ctx.accountId,
        userId: ctx.userId,
      });
    } catch (guardErr) {
      return NextResponse.json(
        {
          error:
            guardErr instanceof Error
              ? guardErr.message
              : "Path de storage inválido.",
        },
        { status: 403 },
      );
    }

    if (storageDriver() === "r2") {
      // Paths legados do Supabase (sem prefixo R2) não existem no R2 —
      // ignore com sucesso para GC de drafts mistos.
      const looksR2 =
        path.startsWith("chat/") ||
        path.startsWith("flow/") ||
        path.startsWith("branding/") ||
        path.startsWith("avatars/");
      if (!looksR2) {
        return NextResponse.json({ ok: true });
      }
      const target = resolveR2Target(logicalBucket);
      await deleteR2Object({ bucket: target.r2Bucket, key: path });
      return NextResponse.json({ ok: true });
    }

    const sbBucket = supabaseBucketFor(logicalBucket);
    const { error } = await ctx.supabase.storage.from(sbBucket).remove([path]);
    if (error) {
      console.error("[storage/object] Supabase remove:", error);
      return NextResponse.json(
        { error: error.message || "Falha ao remover arquivo." },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
