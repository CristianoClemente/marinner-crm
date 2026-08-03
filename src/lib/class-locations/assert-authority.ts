import type { SupabaseClient } from "@supabase/supabase-js";

/** Garante que authority_id está vinculada à conta em account_jurisdictions. */
export async function assertAccountHasAuthority(
  supabase: SupabaseClient,
  accountId: string,
  authorityId: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await supabase
    .from("account_jurisdictions")
    .select("id")
    .eq("account_id", accountId)
    .eq("authority_id", authorityId)
    .maybeSingle();

  if (error) {
    console.error("[assertAccountHasAuthority]", error);
    return { ok: false, message: error.message };
  }
  if (!data) {
    return {
      ok: false,
      message:
        "Vincule esta jurisdição em Configurações → Jurisdições antes de usá-la no local.",
    };
  }
  return { ok: true };
}
