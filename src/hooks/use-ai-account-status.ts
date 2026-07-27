"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

/**
 * Account-level AI status, shared across inbox surfaces (composer draft
 * button, auto-reply banner). Cached per account so opening another
 * thread does not re-hit `/api/ai/config`. Only successful responses are
 * cached — transient failures retry on the next consumer mount.
 */
export interface AiAccountStatus {
  /** Row exists in `ai_configs`. */
  configured: boolean;
  /** Draft/reply can run: configured + API key + master switch on. */
  draftAvailable: boolean;
  /** Auto-reply bot is live at account level. */
  autoReplyOn: boolean;
}

const DEFAULT_STATUS: AiAccountStatus = {
  configured: false,
  draftAvailable: false,
  autoReplyOn: false,
};

const statusCache = new Map<string, AiAccountStatus>();

export function invalidateAiAccountStatusCache(accountId?: string): void {
  if (accountId) statusCache.delete(accountId);
  else statusCache.clear();
}

export async function fetchAiAccountStatus(
  accountId: string,
): Promise<AiAccountStatus> {
  const cached = statusCache.get(accountId);
  if (cached) return cached;
  try {
    const res = await fetch("/api/ai/config", { cache: "no-store" });
    if (!res.ok) return DEFAULT_STATUS;
    const j = (await res.json()) as {
      configured?: boolean;
      has_key?: boolean;
      is_active?: boolean;
      auto_reply_enabled?: boolean;
    };
    const configured = !!j.configured;
    const draftAvailable = !!(configured && j.has_key && j.is_active);
    const status: AiAccountStatus = {
      configured,
      draftAvailable,
      autoReplyOn: !!(draftAvailable && j.auto_reply_enabled),
    };
    statusCache.set(accountId, status);
    return status;
  } catch {
    return DEFAULT_STATUS;
  }
}

/**
 * `null` while loading / sem accountId; depois o status resolvido.
 */
export function useAiAccountStatus(): AiAccountStatus | null {
  const { accountId } = useAuth();
  const [status, setStatus] = useState<AiAccountStatus | null>(null);

  useEffect(() => {
    if (!accountId) {
      setStatus(null);
      return;
    }
    let alive = true;
    fetchAiAccountStatus(accountId).then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [accountId]);

  return status;
}
