import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveR2Target, storageDriver } from "@/lib/storage/bucket-map";
import { deleteR2Object } from "@/lib/storage/r2";

const BATCH = 50;

type ExpiredRow = {
  id: string;
  account_id: string;
  r2_key: string;
  public_url: string;
  message_id: string | null;
};

/**
 * Apaga objetos de conversa expirados e limpa media_url nas messages.
 * Usa client service-role (bypass RLS).
 */
export async function runChatMediaGc(
  admin: SupabaseClient,
): Promise<{ scanned: number; deleted: number; errors: number }> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("chat_media_objects")
    .select("id, account_id, r2_key, public_url, message_id")
    .is("deleted_at", null)
    .lte("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    console.error("[storage/cron] list expired:", error);
    throw error;
  }

  const rows = (data ?? []) as ExpiredRow[];
  let deleted = 0;
  let errors = 0;
  const driver = storageDriver();
  const r2Target = driver === "r2" ? resolveR2Target("chat-media") : null;

  for (const row of rows) {
    try {
      if (r2Target) {
        await deleteR2Object({ bucket: r2Target.r2Bucket, key: row.r2_key });
      } else {
        const { error: rmErr } = await admin.storage
          .from("chat-media")
          .remove([row.r2_key]);
        if (rmErr) throw rmErr;
      }

      const { error: updErr } = await admin
        .from("chat_media_objects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id);
      if (updErr) throw updErr;

      if (row.message_id) {
        await admin
          .from("messages")
          .update({ media_url: null })
          .eq("id", row.message_id)
          .eq("media_url", row.public_url);
      } else if (row.public_url) {
        await admin
          .from("messages")
          .update({ media_url: null })
          .eq("media_url", row.public_url);
      }

      deleted += 1;
    } catch (err) {
      errors += 1;
      console.error("[storage/cron] GC item falhou:", row.id, err);
    }
  }

  return { scanned: rows.length, deleted, errors };
}
