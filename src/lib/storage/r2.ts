import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let cached: S3Client | null = null;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente ausente: ${name}`);
  }
  return value;
}

export function r2Client(): S3Client {
  if (cached) return cached;
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");
  const endpoint =
    process.env.R2_ENDPOINT?.trim() ||
    `https://${accountId}.r2.cloudflarestorage.com`;

  cached = new S3Client({
    region: process.env.R2_REGION?.trim() || "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cached;
}

export function publicUrlFor(publicBaseUrl: string, key: string): string {
  const base = publicBaseUrl.replace(/\/+$/, "");
  const path = key.replace(/^\/+/, "");
  return `${base}/${path}`;
}

export async function putR2Object(input: {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  publicBaseUrl: string;
}): Promise<{ path: string; publicUrl: string }> {
  try {
    await r2Client().send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: "public, max-age=3600",
      }),
    );
  } catch (err) {
    console.error("[storage/r2] PutObject falhou:", err);
    throw new Error("Falha ao enviar arquivo para o storage.");
  }
  return {
    path: input.key,
    publicUrl: publicUrlFor(input.publicBaseUrl, input.key),
  };
}

export async function deleteR2Object(input: {
  bucket: string;
  key: string;
}): Promise<void> {
  try {
    await r2Client().send(
      new DeleteObjectCommand({
        Bucket: input.bucket,
        Key: input.key,
      }),
    );
  } catch (err) {
    console.error("[storage/r2] DeleteObject falhou:", err);
    throw new Error("Falha ao remover arquivo do storage.");
  }
}
