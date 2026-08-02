import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/lib/processes/validate";

export type AgendaAssignee = {
  user_id: string;
  full_name: string | null;
  avatar_url?: string | null;
};

const MAX_ASSIGNEES = 20;

export function parseAssigneeUserIds(
  value: unknown,
): { ok: true; value: string[] } | { ok: false; message: string } {
  if (value === null || value === undefined) {
    return { ok: true, value: [] };
  }
  if (!Array.isArray(value)) {
    return { ok: false, message: "Integrantes inválidos." };
  }
  if (value.length > MAX_ASSIGNEES) {
    return { ok: false, message: `Máximo de ${MAX_ASSIGNEES} integrantes.` };
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string" || !isUuid(item)) {
      return { ok: false, message: "Integrante inválido." };
    }
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return { ok: true, value: out };
}

export async function assertAssigneesInAccount(
  supabase: SupabaseClient,
  accountId: string,
  userIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (userIds.length === 0) return { ok: true };
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("account_id", accountId)
    .in("user_id", userIds);
  if (error) {
    return { ok: false, message: error.message };
  }
  if ((data ?? []).length !== userIds.length) {
    return { ok: false, message: "Integrante inválido." };
  }
  return { ok: true };
}

export async function replaceEventAssignees(input: {
  supabase: SupabaseClient;
  accountId: string;
  eventId: string;
  userIds: string[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: delErr } = await input.supabase
    .from("agenda_event_assignees")
    .delete()
    .eq("account_id", input.accountId)
    .eq("event_id", input.eventId);
  if (delErr) {
    return { ok: false, message: delErr.message };
  }
  if (input.userIds.length === 0) return { ok: true };

  const { error: insErr } = await input.supabase
    .from("agenda_event_assignees")
    .insert(
      input.userIds.map((user_id) => ({
        account_id: input.accountId,
        event_id: input.eventId,
        user_id,
      })),
    );
  if (insErr) {
    return { ok: false, message: insErr.message };
  }
  return { ok: true };
}

export async function attachAssigneesToEvents(
  supabase: SupabaseClient,
  accountId: string,
  events: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown> & { assignees: AgendaAssignee[] }>> {
  if (events.length === 0) return [];

  const eventIds = events
    .map((e) => e.id)
    .filter((id): id is string => typeof id === "string");

  const { data: links } = await supabase
    .from("agenda_event_assignees")
    .select("event_id, user_id")
    .eq("account_id", accountId)
    .in("event_id", eventIds);

  const userIds = [
    ...new Set((links ?? []).map((l) => l.user_id as string)),
  ];
  const profileMap = new Map<string, AgendaAssignee>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .eq("account_id", accountId)
      .in("user_id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.user_id as string, {
        user_id: p.user_id as string,
        full_name: (p.full_name as string | null) ?? null,
        avatar_url: (p.avatar_url as string | null) ?? null,
      });
    }
  }

  const byEvent = new Map<string, AgendaAssignee[]>();
  for (const link of links ?? []) {
    const eventId = link.event_id as string;
    const profile = profileMap.get(link.user_id as string);
    if (!profile) continue;
    const list = byEvent.get(eventId) ?? [];
    list.push(profile);
    byEvent.set(eventId, list);
  }

  return events.map((e) => {
    const id = typeof e.id === "string" ? e.id : "";
    const { assignee_user_id: _drop, assignee: _drop2, ...rest } = e;
    return {
      ...rest,
      assignees: byEvent.get(id) ?? [],
    };
  });
}
