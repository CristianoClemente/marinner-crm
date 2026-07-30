import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHAT_MEDIA_BASE_QUOTA_BYTES,
  CHAT_MEDIA_RETENTION_DAYS,
  effectiveQuotaBytes,
  retentionExpiresAt,
  wouldExceedQuota,
  type StoragePackageRow,
} from "@/lib/storage/chat-quota";

export type ChatStorageSnapshot = {
  usedBytes: number;
  quotaBytes: number;
  retentionDays: number;
  baseQuotaBytes: number;
  packages: Array<{
    id: string;
    label: string;
    extra_bytes: number;
    starts_at: string;
    ends_at: string | null;
    status: string;
    notes: string | null;
  }>;
};

export async function getChatStorageSnapshot(
  supabase: SupabaseClient,
  accountId: string,
): Promise<ChatStorageSnapshot> {
  const [usageRes, packagesRes] = await Promise.all([
    supabase
      .from("chat_media_objects")
      .select("bytes")
      .eq("account_id", accountId)
      .is("deleted_at", null),
    supabase
      .from("account_storage_packages")
      .select(
        "id, label, extra_bytes, starts_at, ends_at, status, notes",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false }),
  ]);

  if (usageRes.error) throw usageRes.error;
  if (packagesRes.error) throw packagesRes.error;

  const usedBytes = (usageRes.data ?? []).reduce(
    (sum, row) => sum + Number(row.bytes ?? 0),
    0,
  );
  const packages = (packagesRes.data ?? []) as ChatStorageSnapshot["packages"];
  const quotaBytes = effectiveQuotaBytes(
    packages as StoragePackageRow[],
    CHAT_MEDIA_BASE_QUOTA_BYTES,
  );

  return {
    usedBytes,
    quotaBytes,
    retentionDays: CHAT_MEDIA_RETENTION_DAYS,
    baseQuotaBytes: CHAT_MEDIA_BASE_QUOTA_BYTES,
    packages,
  };
}

export async function assertChatQuotaAvailable(
  supabase: SupabaseClient,
  accountId: string,
  incomingBytes: number,
): Promise<void> {
  const snap = await getChatStorageSnapshot(supabase, accountId);
  if (wouldExceedQuota(snap.usedBytes, incomingBytes, snap.quotaBytes)) {
    const err = new Error(
      "Limite de armazenamento de conversas atingido. Libere espaço ou solicite um pacote extra.",
    );
    (err as Error & { status?: number }).status = 413;
    throw err;
  }
}

export async function registerChatMediaObject(
  supabase: SupabaseClient,
  input: {
    accountId: string;
    r2Key: string;
    publicUrl: string;
    bytes: number;
    contentType: string;
  },
): Promise<{ id: string }> {
  const expires = retentionExpiresAt();
  const { data, error } = await supabase
    .from("chat_media_objects")
    .insert({
      account_id: input.accountId,
      r2_key: input.r2Key,
      public_url: input.publicUrl,
      bytes: input.bytes,
      content_type: input.contentType,
      expires_at: expires.toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function markChatMediaDeletedByKey(
  supabase: SupabaseClient,
  accountId: string,
  r2Key: string,
): Promise<void> {
  const { error } = await supabase
    .from("chat_media_objects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .eq("r2_key", r2Key)
    .is("deleted_at", null);
  if (error) throw error;
}

export async function linkChatMediaToMessage(
  supabase: SupabaseClient,
  input: { accountId: string; r2Key: string; messageId: string },
): Promise<void> {
  const { error } = await supabase
    .from("chat_media_objects")
    .update({ message_id: input.messageId })
    .eq("account_id", input.accountId)
    .eq("r2_key", input.r2Key)
    .is("deleted_at", null);
  if (error) throw error;
}
