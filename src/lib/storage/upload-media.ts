/**
 * Helper de upload/delete de mídia da conta.
 *
 * O browser sempre chama `/api/storage/*`; o servidor escolhe o driver
 * (`STORAGE_DRIVER=r2|supabase`). Path e limites continuam em
 * `media-path.ts` / `bucket-map.ts`.
 */

export {
  MEDIA_MAX_BYTES,
  MEDIA_MAX_BYTES_BY_KIND,
  buildMediaPath,
} from "@/lib/storage/media-path";

export interface UploadAccountMediaResult {
  /** URL pública (Meta / CDN / r2.dev). */
  publicUrl: string;
  /** Path do objeto (usar no delete). */
  path: string;
}

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error && typeof data.error === "string") return data.error;
  } catch {
    // ignore
  }
  return `Falha no storage (${res.status}).`;
}

/**
 * Envia arquivo via API autenticada. Validação de tamanho fica a cargo
 * do caller (`MEDIA_MAX_BYTES` / `MEDIA_MAX_BYTES_BY_KIND`).
 */
export async function uploadAccountMedia(
  bucket: string,
  file: File,
): Promise<UploadAccountMediaResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("bucket", bucket);

  const res = await fetch("/api/storage/upload", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const data = (await res.json()) as UploadAccountMediaResult;
  if (!data?.publicUrl || !data?.path) {
    throw new Error("Resposta de upload inválida.");
  }
  return { publicUrl: data.publicUrl, path: data.path };
}

/**
 * Remove objeto previamente enviado (GC de drafts). Best-effort nos callers.
 */
export async function deleteAccountMedia(
  bucket: string,
  path: string,
): Promise<void> {
  const res = await fetch("/api/storage/object", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, path }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
}
