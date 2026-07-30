import { NextResponse } from "next/server";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  buildObjectKey,
  buildSupabaseObjectPath,
  isLogicalBucket,
  minRoleForBucket,
  resolveR2Target,
  storageDriver,
  supabaseBucketFor,
} from "@/lib/storage/bucket-map";
import { MEDIA_MAX_BYTES } from "@/lib/storage/media-path";
import { putR2Object } from "@/lib/storage/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const bucketRaw = form.get("bucket");
    const file = form.get("file");

    if (typeof bucketRaw !== "string" || !isLogicalBucket(bucketRaw)) {
      return NextResponse.json(
        { error: "Bucket de storage inválido." },
        { status: 400 },
      );
    }
    const logicalBucket = bucketRaw;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo é obrigatório." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Arquivo vazio." },
        { status: 400 },
      );
    }

    if (file.size > MEDIA_MAX_BYTES) {
      return NextResponse.json(
        { error: "Arquivo excede o tamanho máximo permitido." },
        { status: 413 },
      );
    }

    const ctx = await requireRole(minRoleForBucket(logicalBucket));
    const contentType = file.type || "application/octet-stream";
    const bytes = Buffer.from(await file.arrayBuffer());

    if (storageDriver() === "r2") {
      const target = resolveR2Target(logicalBucket);
      const key = buildObjectKey({
        logicalBucket,
        accountId: ctx.accountId,
        userId: ctx.userId,
        fileName: file.name,
      });
      const result = await putR2Object({
        bucket: target.r2Bucket,
        key,
        body: bytes,
        contentType,
        publicBaseUrl: target.publicBaseUrl,
      });
      return NextResponse.json(result);
    }

    const sbBucket = supabaseBucketFor(logicalBucket);
    const path = buildSupabaseObjectPath({
      logicalBucket,
      accountId: ctx.accountId,
      userId: ctx.userId,
      fileName: file.name,
    });

    const { error: upErr } = await ctx.supabase.storage
      .from(sbBucket)
      .upload(path, bytes, {
        cacheControl: "3600",
        upsert: logicalBucket === "avatars",
        contentType,
      });
    if (upErr) {
      console.error("[storage/upload] Supabase upload:", upErr);
      return NextResponse.json(
        { error: upErr.message || "Falha no upload." },
        { status: 500 },
      );
    }

    const {
      data: { publicUrl },
    } = ctx.supabase.storage.from(sbBucket).getPublicUrl(path);

    return NextResponse.json({ publicUrl, path });
  } catch (err) {
    return toErrorResponse(err);
  }
}
