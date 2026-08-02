import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/whatsapp/encryption";
import { isWhatsAppProvider } from "@/lib/whatsapp/provider-guards";
import type { WhatsAppProvider } from "@/types";

export type WhatsAppHealthReason =
  | "ok"
  | "no_account"
  | "no_config"
  | "token_corrupted"
  | "disconnected"
  | "db_error";

/**
 * GET /api/whatsapp/status
 * Saúde leve para o chrome do app: lê config + tenta decrypt.
 * Não pinga Meta/Z-API (isso fica em GET /api/whatsapp/config).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const accountId = profile?.account_id as string | undefined;
    if (!accountId) {
      return NextResponse.json({
        online: false,
        reason: "no_account" satisfies WhatsAppHealthReason,
      });
    }

    const { data: config, error: configError } = await supabase
      .from("whatsapp_config")
      .select(
        "provider, status, access_token, phone_number_id, zapi_instance_id, zapi_instance_token, zapi_client_token",
      )
      .eq("account_id", accountId)
      .maybeSingle();

    if (configError) {
      return NextResponse.json({
        online: false,
        reason: "db_error" satisfies WhatsAppHealthReason,
      });
    }

    if (!config) {
      return NextResponse.json({
        online: false,
        reason: "no_config" satisfies WhatsAppHealthReason,
      });
    }

    const provider: WhatsAppProvider = isWhatsAppProvider(config.provider)
      ? config.provider
      : "meta";

    try {
      if (provider === "zapi") {
        if (
          !config.zapi_instance_id ||
          !config.zapi_instance_token ||
          !config.zapi_client_token
        ) {
          return NextResponse.json({
            online: false,
            provider,
            reason: "no_config" satisfies WhatsAppHealthReason,
          });
        }
        decrypt(config.zapi_instance_token);
        decrypt(config.zapi_client_token);
      } else {
        if (!config.access_token || !config.phone_number_id) {
          return NextResponse.json({
            online: false,
            provider,
            reason: "no_config" satisfies WhatsAppHealthReason,
          });
        }
        decrypt(config.access_token);
      }
    } catch {
      return NextResponse.json({
        online: false,
        provider,
        reason: "token_corrupted" satisfies WhatsAppHealthReason,
        needs_reset: true,
      });
    }

    if (config.status !== "connected") {
      return NextResponse.json({
        online: false,
        provider,
        reason: "disconnected" satisfies WhatsAppHealthReason,
      });
    }

    return NextResponse.json({
      online: true,
      provider,
      reason: "ok" satisfies WhatsAppHealthReason,
    });
  } catch {
    return NextResponse.json({
      online: false,
      reason: "db_error" satisfies WhatsAppHealthReason,
    });
  }
}
