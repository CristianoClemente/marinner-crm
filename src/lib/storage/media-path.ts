/**
 * Convenção de path account-scoped (migrations 020/023):
 *   account-<account_id>/<timestamp>-<basename>.<ext>
 */

/** 16 MB — limite dos buckets de mídia. */
export const MEDIA_MAX_BYTES = 16 * 1024 * 1024;

/**
 * Tetos por tipo alinhados à WhatsApp Cloud API (imagem 5 MB).
 */
export const MEDIA_MAX_BYTES_BY_KIND = {
  image: 5 * 1024 * 1024,
  video: 16 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  document: 16 * 1024 * 1024,
} as const;

/**
 * Path account-scoped puro (sem prefixo chat/flow). Exportado para testes.
 */
export function buildMediaPath(
  accountId: string,
  fileName: string,
  now: number = Date.now(),
): string {
  const hasExt = /\.[^.]+$/.test(fileName);
  const ext = hasExt ? fileName.split(".").pop()!.toLowerCase() : "bin";
  const safeBase =
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .slice(0, 40) || "file";
  return `account-${accountId}/${now}-${safeBase}.${ext}`;
}
