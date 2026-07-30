import { buildMediaPath } from "@/lib/storage/media-path";

export const LOGICAL_BUCKETS = [
  "chat-media",
  "flow-media",
  "account-branding",
  "avatars",
] as const;

export type LogicalBucket = (typeof LOGICAL_BUCKETS)[number];

export function isLogicalBucket(value: string): value is LogicalBucket {
  return (LOGICAL_BUCKETS as readonly string[]).includes(value);
}

/** Role mínima para upload/delete em cada bucket lógico. */
export function minRoleForBucket(
  bucket: LogicalBucket,
): "instructor" | "agent" | "admin" {
  if (bucket === "avatars") return "instructor";
  if (bucket === "account-branding") return "admin";
  return "agent";
}

export type R2Target = {
  r2Bucket: string;
  prefix: string;
  publicBaseUrl: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

function mediaBucketName(): string {
  // Só use o bucket de dev se marcado explicitamente — o r2.dev
  // público de MEDIA precisa apontar para o mesmo bucket.
  if (process.env.R2_USE_MEDIA_DEV === "true") {
    return requireEnv("R2_BUCKET_MEDIA_DEV");
  }
  return requireEnv("R2_BUCKET_MEDIA");
}

function mediaPublicBase(): string {
  return (
    process.env.R2_PUBLIC_BASE_URL_MEDIA?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    ""
  );
}

/**
 * Resolve bucket R2 + prefixo + URL pública para um bucket lógico.
 * Só usar no servidor (lê process.env).
 */
export function resolveR2Target(logicalBucket: LogicalBucket): R2Target {
  if (logicalBucket === "chat-media") {
    const publicBaseUrl = mediaPublicBase();
    if (!publicBaseUrl) {
      throw new Error("Variável de ambiente ausente: R2_PUBLIC_BASE_URL_MEDIA");
    }
    return {
      r2Bucket: mediaBucketName(),
      prefix: "chat/",
      publicBaseUrl,
    };
  }
  if (logicalBucket === "flow-media") {
    const publicBaseUrl = mediaPublicBase();
    if (!publicBaseUrl) {
      throw new Error("Variável de ambiente ausente: R2_PUBLIC_BASE_URL_MEDIA");
    }
    return {
      r2Bucket: mediaBucketName(),
      prefix: "flow/",
      publicBaseUrl,
    };
  }
  const publicBaseUrl = requireEnv("R2_PUBLIC_BASE_URL_BRANDING");
  const r2Bucket = requireEnv("R2_BUCKET_BRANDING");
  if (logicalBucket === "account-branding") {
    return { r2Bucket, prefix: "branding/", publicBaseUrl };
  }
  return { r2Bucket, prefix: "avatars/", publicBaseUrl };
}

/** Bucket Supabase Storage correspondente (driver legado). */
export function supabaseBucketFor(logicalBucket: LogicalBucket): string {
  return logicalBucket;
}

const R2_PREFIX: Record<LogicalBucket, string> = {
  "chat-media": "chat/",
  "flow-media": "flow/",
  "account-branding": "branding/",
  avatars: "avatars/",
};

/** Prefixo R2 puro (sem ler env) — usado em keys e testes. */
export function r2PrefixFor(logicalBucket: LogicalBucket): string {
  return R2_PREFIX[logicalBucket];
}

export function buildObjectKey(input: {
  logicalBucket: LogicalBucket;
  accountId: string;
  userId: string;
  fileName: string;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  const prefix = r2PrefixFor(input.logicalBucket);

  if (input.logicalBucket === "avatars") {
    const hasExt = /\.[^.]+$/.test(input.fileName);
    const ext = hasExt
      ? input.fileName.split(".").pop()!.toLowerCase()
      : "png";
    return `${prefix}account-${input.accountId}/user-${input.userId}/avatar-${now}.${ext}`;
  }

  const accountPath = buildMediaPath(input.accountId, input.fileName, now);
  return `${prefix}${accountPath}`;
}

/**
 * Path relativo ao bucket Supabase (sem prefixo chat/flow/…).
 * Avatars: `user-<id>/avatar-…` sob o bucket `avatars` (legado).
 */
export function buildSupabaseObjectPath(input: {
  logicalBucket: LogicalBucket;
  accountId: string;
  userId: string;
  fileName: string;
  now?: number;
}): string {
  const now = input.now ?? Date.now();
  if (input.logicalBucket === "avatars") {
    const hasExt = /\.[^.]+$/.test(input.fileName);
    const ext = hasExt
      ? input.fileName.split(".").pop()!.toLowerCase()
      : "png";
    return `${input.userId}/avatar-${now}.${ext}`;
  }
  return buildMediaPath(input.accountId, input.fileName, now);
}

export function assertPathAllowed(input: {
  logicalBucket: LogicalBucket;
  path: string;
  accountId: string;
  userId: string;
}): void {
  const path = input.path.replace(/^\/+/, "");
  if (path.includes("..") || path.startsWith("/")) {
    throw new Error("Path de storage inválido.");
  }

  if (input.logicalBucket === "avatars") {
    // R2: avatars/account-<id>/user-<uid>/…
    const r2Prefix = `avatars/account-${input.accountId}/user-${input.userId}/`;
    // Supabase legado: <userId>/…
    const sbPrefix = `${input.userId}/`;
    if (path.startsWith(r2Prefix) || path.startsWith(sbPrefix)) return;
    throw new Error("Path de avatar fora do escopo do usuário.");
  }

  const accountSeg = `account-${input.accountId}/`;
  if (input.logicalBucket === "chat-media") {
    if (
      path.startsWith(`chat/${accountSeg}`) ||
      path.startsWith(accountSeg)
    ) {
      return;
    }
  } else if (input.logicalBucket === "flow-media") {
    if (
      path.startsWith(`flow/${accountSeg}`) ||
      path.startsWith(accountSeg)
    ) {
      return;
    }
  } else if (input.logicalBucket === "account-branding") {
    if (
      path.startsWith(`branding/${accountSeg}`) ||
      path.startsWith(accountSeg)
    ) {
      return;
    }
  }

  throw new Error("Path de storage fora do escopo da conta.");
}

export function storageDriver(): "r2" | "supabase" {
  return process.env.STORAGE_DRIVER === "r2" ? "r2" : "supabase";
}
