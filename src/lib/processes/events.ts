import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProcessDomainEventType } from "@/lib/processes/types";

export async function emitProcessEvent(
  supabase: SupabaseClient,
  input: {
    accountId: string;
    eventType: ProcessDomainEventType;
    payload: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("process_domain_events").insert({
    account_id: input.accountId,
    event_type: input.eventType,
    payload: input.payload,
  });
  if (error) {
    console.error("[processes/events] emit:", error);
    throw error;
  }
}
