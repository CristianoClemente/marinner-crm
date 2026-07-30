/** Constantes e cálculos puros de quota de mídia de conversa. */

export const CHAT_MEDIA_RETENTION_DAYS = Number(
  process.env.CHAT_MEDIA_RETENTION_DAYS || 180,
);

/** 5 GiB padrão. */
export const CHAT_MEDIA_BASE_QUOTA_BYTES = Number(
  process.env.CHAT_MEDIA_BASE_QUOTA_BYTES || 5 * 1024 * 1024 * 1024,
);

export const GIB = 1024 * 1024 * 1024;

export type StoragePackageRow = {
  extra_bytes: number;
  status: string;
  starts_at: string;
  ends_at: string | null;
};

export function retentionExpiresAt(
  from: Date = new Date(),
  retentionDays: number = CHAT_MEDIA_RETENTION_DAYS,
): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + retentionDays);
  return d;
}

/**
 * Soma bytes extras de pacotes active dentro da vigência.
 */
export function sumActivePackageBytes(
  packages: StoragePackageRow[],
  now: Date = new Date(),
): number {
  let total = 0;
  const t = now.getTime();
  for (const p of packages) {
    if (p.status !== "active") continue;
    const start = new Date(p.starts_at).getTime();
    if (Number.isFinite(start) && start > t) continue;
    if (p.ends_at) {
      const end = new Date(p.ends_at).getTime();
      if (Number.isFinite(end) && end <= t) continue;
    }
    const n = Number(p.extra_bytes);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

export function effectiveQuotaBytes(
  packages: StoragePackageRow[],
  baseBytes: number = CHAT_MEDIA_BASE_QUOTA_BYTES,
  now: Date = new Date(),
): number {
  return baseBytes + sumActivePackageBytes(packages, now);
}

export function wouldExceedQuota(
  usedBytes: number,
  incomingBytes: number,
  quotaBytes: number,
): boolean {
  return usedBytes + incomingBytes > quotaBytes;
}

export function formatBytesPt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let n = bytes;
  let i = -1;
  do {
    n /= 1024;
    i += 1;
  } while (n >= 1024 && i < units.length - 1);
  const rounded = Number.isInteger(n) || n >= 10 ? n.toFixed(0) : n.toFixed(1);
  return `${rounded} ${units[i]}`;
}
