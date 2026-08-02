"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

export type WhatsAppHealthReason =
  | "ok"
  | "no_account"
  | "no_config"
  | "token_corrupted"
  | "disconnected"
  | "db_error";

export type WhatsAppHealth = {
  online: boolean;
  reason: WhatsAppHealthReason;
  needsReset: boolean;
  loading: boolean;
};

const INITIAL: WhatsAppHealth = {
  online: true,
  reason: "ok",
  needsReset: false,
  loading: true,
};

/**
 * Saúde leve do canal WhatsApp para chrome (header).
 * Assume online enquanto carrega para não piscar o ícone.
 */
export function useWhatsAppHealth(): WhatsAppHealth {
  const { accountId } = useAuth();
  const [state, setState] = useState<WhatsAppHealth>(INITIAL);

  useEffect(() => {
    if (!accountId) {
      setState({
        online: false,
        reason: "no_account",
        needsReset: false,
        loading: false,
      });
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch("/api/whatsapp/status", { signal: ac.signal });
        if (!res.ok) {
          if (!cancelled) {
            setState({
              online: false,
              reason: "db_error",
              needsReset: false,
              loading: false,
            });
          }
          return;
        }
        const json = (await res.json()) as {
          online?: boolean;
          reason?: WhatsAppHealthReason;
          needs_reset?: boolean;
        };
        if (cancelled) return;
        setState({
          online: Boolean(json.online),
          reason: json.reason ?? (json.online ? "ok" : "disconnected"),
          needsReset: Boolean(json.needs_reset),
          loading: false,
        });
      } catch {
        if (cancelled || ac.signal.aborted) return;
        setState({
          online: false,
          reason: "db_error",
          needsReset: false,
          loading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [accountId]);

  return state;
}
