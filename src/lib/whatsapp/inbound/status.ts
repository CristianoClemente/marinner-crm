import type { SupabaseClient } from '@supabase/supabase-js'
import { dispatchWebhookEvent } from '@/lib/webhooks/deliver'
import type { MessageStatusEvent } from './types'

// Happy-path ladder — pending → sent → delivered → read → replied.
// Webhook replays must never regress a recipient back down this ladder.
// `failed` is a terminal side branch only valid from pending/sent.
const RECIPIENT_STATUS_LADDER = [
  'pending',
  'sent',
  'delivered',
  'read',
  'replied',
] as const

function ladderLevel(s: string): number {
  const idx = (RECIPIENT_STATUS_LADDER as readonly string[]).indexOf(s)
  return idx < 0 ? -1 : idx
}

/**
 * Can a recipient transition from `current` to `incoming`?
 */
export function isValidStatusTransition(
  current: string,
  incoming: string,
): boolean {
  if (incoming === 'failed') {
    return current === 'pending' || current === 'sent'
  }
  if (current === 'failed') {
    return false
  }
  const ci = ladderLevel(current)
  const ii = ladderLevel(incoming)
  if (ii < 0) return false
  if (ci < 0) return true
  return ii > ci
}

/** Map Z-API status strings onto our messages.status / ladder values. */
export function mapZapiStatusToInternal(status: string): string | null {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'pending'
    case 'SENT':
      return 'sent'
    case 'RECEIVED':
      return 'delivered'
    case 'READ':
    case 'READ_BY_ME':
    case 'PLAYED':
      return 'read'
    case 'ERROR':
    case 'FAILED':
      return 'failed'
    default:
      return null
  }
}

/**
 * Mirror a provider status onto `messages` + `broadcast_recipients`,
 * then fan out `message.status_updated` for public webhooks.
 */
export async function applyMessageStatusUpdate(
  db: SupabaseClient,
  event: MessageStatusEvent,
): Promise<void> {
  const { providerMessageId, status } = event
  if (!providerMessageId || !status) return

  const { error: msgErr } = await db
    .from('messages')
    .update({ status })
    .eq('message_id', providerMessageId)

  if (msgErr) {
    // Best-effort — do not throw; other mirrors still run.
  }

  const tsMs =
    event.timestampMs > 1e12 ? event.timestampMs : event.timestampMs * 1000
  const tsIso = new Date(tsMs).toISOString()

  const { data: recipient, error: recFetchErr } = await db
    .from('broadcast_recipients')
    .select('id, status')
    .eq('whatsapp_message_id', providerMessageId)
    .maybeSingle()

  if (
    !recFetchErr &&
    recipient &&
    isValidStatusTransition(recipient.status, status)
  ) {
    const update: Record<string, unknown> = { status }
    if (status === 'sent') update.sent_at = tsIso
    if (status === 'delivered') update.delivered_at = tsIso
    if (status === 'read') update.read_at = tsIso

    await db.from('broadcast_recipients').update(update).eq('id', recipient.id)
  }

  const { data: msgRow } = await db
    .from('messages')
    .select('conversation_id, conversations(account_id)')
    .eq('message_id', providerMessageId)
    .limit(1)
    .maybeSingle()

  if (msgRow) {
    const conv = msgRow.conversations as unknown as {
      account_id: string
    } | null
    const accountId = conv?.account_id
    if (accountId) {
      await dispatchWebhookEvent(db, accountId, 'message.status_updated', {
        whatsapp_message_id: providerMessageId,
        conversation_id: msgRow.conversation_id,
        status,
      })
    }
  }
}
