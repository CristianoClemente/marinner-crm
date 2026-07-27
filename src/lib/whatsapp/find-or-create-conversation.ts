import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Return the contact's conversation id in this account, creating one if
 * it doesn't exist yet. Used by dashboard send (`contact_id`) and by
 * "Nova mensagem" (Z-API open chat without sending yet).
 */
export async function findOrCreateConversationForContact(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  accountId: string,
  userId: string,
  contactId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .maybeSingle()

  if (existing) return existing.id as string

  const { data: created, error } = await supabase
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: userId,
      contact_id: contactId,
    })
    .select('id')
    .single()

  if (error || !created) {
    return null
  }

  return created.id as string
}
