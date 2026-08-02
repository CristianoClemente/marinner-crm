import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireRole, toErrorResponse } from "@/lib/auth/account";
import {
  normalizeScalarValue,
  parseFieldConfig,
} from "@/lib/processes/field-types";
import {
  fieldSummary,
  requiredMissingLabels,
  type FieldWithValue,
} from "@/lib/processes/field-values";
import { isUuid } from "@/lib/processes/validate";
import type {
  ProcessFieldValueRow,
  ProcessTemplateStageField,
} from "@/lib/processes/types";
import {
  assertPathAllowed,
  buildProcessDocKey,
  buildSupabaseObjectPath,
  resolveR2Target,
  storageDriver,
  supabaseBucketFor,
} from "@/lib/storage/bucket-map";
import { MEDIA_MAX_BYTES } from "@/lib/storage/media-path";
import { deleteR2Object, putR2Object } from "@/lib/storage/r2";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

async function loadStageFieldsBundle(
  supabase: SupabaseClient,
  accountId: string,
  processId: string,
): Promise<
  | {
      ok: true;
      process: {
        id: string;
        status: string;
        current_stage_id: string | null;
        template_id: string;
      };
      items: FieldWithValue[];
    }
  | { ok: false; status: number; error: string }
> {
  const { data: process, error: pErr } = await supabase
    .from("enrollment_processes")
    .select("id, status, current_stage_id, template_id")
    .eq("account_id", accountId)
    .eq("id", processId)
    .maybeSingle();
  if (pErr || !process) {
    return { ok: false, status: 404, error: "Processo não encontrado." };
  }

  if (!process.current_stage_id) {
    return {
      ok: true,
      process,
      items: [],
    };
  }

  const { data: fields, error: fErr } = await supabase
    .from("process_template_stage_fields")
    .select("*")
    .eq("account_id", accountId)
    .eq("stage_id", process.current_stage_id)
    .order("position", { ascending: true });
  if (fErr) {
    return { ok: false, status: 500, error: fErr.message };
  }

  const fieldRows = (fields ?? []) as ProcessTemplateStageField[];
  const fieldIds = fieldRows.map((f) => f.id);
  let values: ProcessFieldValueRow[] = [];
  if (fieldIds.length > 0) {
    const { data: vals, error: vErr } = await supabase
      .from("process_field_values")
      .select("*")
      .eq("account_id", accountId)
      .eq("process_id", processId)
      .in("field_id", fieldIds);
    if (vErr) {
      return { ok: false, status: 500, error: vErr.message };
    }
    values = (vals ?? []) as ProcessFieldValueRow[];
  }

  const byField = new Map(values.map((v) => [v.field_id, v]));
  const items: FieldWithValue[] = fieldRows.map((field) => ({
    field,
    value: byField.get(field.id) ?? null,
  }));

  return { ok: true, process, items };
}

function jsonFieldsResponse(items: FieldWithValue[]) {
  const missing = requiredMissingLabels(items);
  return {
    fields: items.map((item) => ({
      ...item.field,
      value: item.value,
    })),
    required_missing: missing,
    ...fieldSummary(items),
  };
}

export async function GET(_request: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("viewer");
    const bundle = await loadStageFieldsBundle(ctx.supabase, ctx.accountId, id);
    if (!bundle.ok) {
      return NextResponse.json(
        { error: bundle.error },
        { status: bundle.status },
      );
    }
    return NextResponse.json(jsonFieldsResponse(bundle.items));
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(request: Request, context: Ctx) {
  try {
    const { id: processId } = await context.params;
    if (!isUuid(processId)) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }
    const ctx = await requireRole("agent");
    const bundle = await loadStageFieldsBundle(
      ctx.supabase,
      ctx.accountId,
      processId,
    );
    if (!bundle.ok) {
      return NextResponse.json(
        { error: bundle.error },
        { status: bundle.status },
      );
    }
    if (bundle.process.status !== "active") {
      return NextResponse.json(
        { error: "Só processos ativos aceitam preenchimento." },
        { status: 409 },
      );
    }

    const form = await request.formData();
    const valuesRaw = form.get("values");
    const valueUpdates: Array<{ field_id: string; value: unknown }> = [];
    if (typeof valuesRaw === "string" && valuesRaw.trim()) {
      try {
        const parsed = JSON.parse(valuesRaw) as unknown;
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { error: "values deve ser um array JSON." },
            { status: 400 },
          );
        }
        for (const row of parsed) {
          if (!row || typeof row !== "object") continue;
          const r = row as Record<string, unknown>;
          if (!isUuid(r.field_id)) continue;
          valueUpdates.push({ field_id: r.field_id, value: r.value });
        }
      } catch {
        return NextResponse.json(
          { error: "values JSON inválido." },
          { status: 400 },
        );
      }
    }

    const fieldById = new Map(bundle.items.map((i) => [i.field.id, i]));

    for (const upd of valueUpdates) {
      const item = fieldById.get(upd.field_id);
      if (!item) {
        return NextResponse.json(
          { error: "Campo fora da etapa atual." },
          { status: 400 },
        );
      }
      if (item.field.field_type === "file") continue;

      const normalized = normalizeScalarValue(item.field.field_type, upd.value);
      if (
        item.field.field_type === "select" &&
        normalized !== null &&
        typeof normalized === "string"
      ) {
        const options = parseFieldConfig(item.field.config).options ?? [];
        if (!options.includes(normalized)) {
          return NextResponse.json(
            { error: `Opção inválida em "${item.field.label}".` },
            { status: 400 },
          );
        }
      }

      const { error } = await ctx.supabase.from("process_field_values").upsert(
        {
          account_id: ctx.accountId,
          process_id: processId,
          field_id: upd.field_id,
          value: normalized,
          storage_path: null,
          original_filename: null,
          mime_type: null,
          size_bytes: null,
          updated_at: new Date().toISOString(),
          updated_by_user_id: ctx.userId,
        },
        { onConflict: "process_id,field_id" },
      );
      if (error) {
        console.error("[PUT process fields] scalar", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    for (const [key, entry] of form.entries()) {
      if (typeof key !== "string") continue;

      if (key.startsWith("clear_file_")) {
        const fieldId = key.slice("clear_file_".length);
        if (!isUuid(fieldId) || form.get(key) !== "1") continue;
        const item = fieldById.get(fieldId);
        if (!item || item.field.field_type !== "file") {
          return NextResponse.json(
            { error: "Campo de arquivo inválido." },
            { status: 400 },
          );
        }
        const prevPath = item.value?.storage_path;
        if (prevPath) {
          try {
            await deleteProcessDoc(
              ctx.supabase,
              ctx.accountId,
              ctx.userId,
              prevPath,
            );
          } catch (delErr) {
            console.error("[PUT process fields] clear delete:", delErr);
            return NextResponse.json(
              { error: "Não foi possível remover o arquivo." },
              { status: 500 },
            );
          }
        }
        const { error } = await ctx.supabase.from("process_field_values").upsert(
          {
            account_id: ctx.accountId,
            process_id: processId,
            field_id: fieldId,
            value: null,
            storage_path: null,
            original_filename: null,
            mime_type: null,
            size_bytes: null,
            updated_at: new Date().toISOString(),
            updated_by_user_id: ctx.userId,
          },
          { onConflict: "process_id,field_id" },
        );
        if (error) {
          console.error("[PUT process fields] clear", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        continue;
      }

      if (!key.startsWith("file_") || !(entry instanceof File)) continue;
      const fieldId = key.slice("file_".length);
      if (!isUuid(fieldId)) continue;
      const item = fieldById.get(fieldId);
      if (!item || item.field.field_type !== "file") {
        return NextResponse.json(
          { error: "Campo de arquivo inválido." },
          { status: 400 },
        );
      }

      const config = parseFieldConfig(item.field.config);
      const maxBytes = config.max_bytes ?? MEDIA_MAX_BYTES;
      if (entry.size <= 0) {
        return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
      }
      if (entry.size > maxBytes) {
        return NextResponse.json(
          { error: `Arquivo de "${item.field.label}" excede o tamanho máximo.` },
          { status: 413 },
        );
      }

      const bytes = Buffer.from(await entry.arrayBuffer());
      const contentType = entry.type || "application/octet-stream";
      const prevPath = item.value?.storage_path?.trim() || null;

      let storagePath: string;
      if (storageDriver() === "r2") {
        const target = resolveR2Target("process-docs");
        storagePath = buildProcessDocKey({
          accountId: ctx.accountId,
          processId,
          fieldId,
          fileName: entry.name,
        });
        // Remove o objeto antigo antes do put quando a key muda
        // (ex.: .pdf → .jpg). Mesma key = PutObject sobrescreve.
        if (prevPath && prevPath !== storagePath) {
          try {
            await deleteProcessDoc(
              ctx.supabase,
              ctx.accountId,
              ctx.userId,
              prevPath,
            );
          } catch (delErr) {
            console.error(
              "[PUT process fields] falha ao remover arquivo antigo:",
              delErr,
            );
            return NextResponse.json(
              {
                error:
                  "Não foi possível substituir o arquivo anterior. Tente novamente.",
              },
              { status: 500 },
            );
          }
        }
        await putR2Object({
          bucket: target.r2Bucket,
          key: storagePath,
          body: bytes,
          contentType,
          publicBaseUrl: target.publicBaseUrl,
        });
      } else {
        storagePath = buildSupabaseObjectPath({
          logicalBucket: "process-docs",
          accountId: ctx.accountId,
          userId: ctx.userId,
          fileName: entry.name,
          processId,
          fieldId,
        });
        if (prevPath && prevPath !== storagePath) {
          try {
            await deleteProcessDoc(
              ctx.supabase,
              ctx.accountId,
              ctx.userId,
              prevPath,
            );
          } catch (delErr) {
            console.error(
              "[PUT process fields] falha ao remover arquivo antigo (sb):",
              delErr,
            );
            return NextResponse.json(
              {
                error:
                  "Não foi possível substituir o arquivo anterior. Tente novamente.",
              },
              { status: 500 },
            );
          }
        }
        const { error: upErr } = await ctx.supabase.storage
          .from(supabaseBucketFor("process-docs"))
          .upload(storagePath, bytes, {
            cacheControl: "3600",
            upsert: true,
            contentType,
          });
        if (upErr) {
          console.error("[PUT process fields] sb upload", upErr);
          return NextResponse.json(
            { error: upErr.message || "Falha no upload." },
            { status: 500 },
          );
        }
      }

      const { error } = await ctx.supabase.from("process_field_values").upsert(
        {
          account_id: ctx.accountId,
          process_id: processId,
          field_id: fieldId,
          value: null,
          storage_path: storagePath,
          original_filename: entry.name.slice(0, 200),
          mime_type: contentType.slice(0, 120),
          size_bytes: entry.size,
          updated_at: new Date().toISOString(),
          updated_by_user_id: ctx.userId,
        },
        { onConflict: "process_id,field_id" },
      );
      if (error) {
        console.error("[PUT process fields] file meta", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const refreshed = await loadStageFieldsBundle(
      ctx.supabase,
      ctx.accountId,
      processId,
    );
    if (!refreshed.ok) {
      return NextResponse.json(
        { error: refreshed.error },
        { status: refreshed.status },
      );
    }
    return NextResponse.json(jsonFieldsResponse(refreshed.items));
  } catch (err) {
    return toErrorResponse(err);
  }
}

async function deleteProcessDoc(
  supabase: SupabaseClient,
  accountId: string,
  userId: string,
  path: string,
): Promise<void> {
  assertPathAllowed({
    logicalBucket: "process-docs",
    path,
    accountId,
    userId,
  });
  if (storageDriver() === "r2") {
    const target = resolveR2Target("process-docs");
    await deleteR2Object({ bucket: target.r2Bucket, key: path });
    return;
  }
  await supabase.storage.from(supabaseBucketFor("process-docs")).remove([path]);
}
