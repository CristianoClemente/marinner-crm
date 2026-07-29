import { supabaseAdmin } from "@/lib/flows/admin-client";
import type { TenantBrandRow } from "./headers";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  value: TenantBrandRow | null;
};

const cache = new Map<string, CacheEntry>();

/** Só para testes — limpa o cache em memória. */
export function clearTenantLookupCache(): void {
  cache.clear();
}

/**
 * Busca marca pública da account pelo slug (service role).
 * Cache curto em memória para o middleware não bater no DB a cada request.
 */
export async function lookupTenantBySlug(
  slug: string,
): Promise<TenantBrandRow | null> {
  const key = slug.trim().toLowerCase();
  if (!key) return null;

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }

  const { data, error } = await supabaseAdmin()
    .from("accounts")
    .select("id, name, slug, logo_url")
    .eq("slug", key)
    .maybeSingle();

  if (error) {
    console.error("[lookupTenantBySlug]", error.message);
    return null;
  }

  const row = data
    ? {
        id: data.id as string,
        name: data.name as string,
        slug: data.slug as string,
        logo_url: (data.logo_url as string | null) ?? null,
      }
    : null;

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: row });
  return row;
}
