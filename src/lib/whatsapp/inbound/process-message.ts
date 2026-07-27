import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/whatsapp/phone-utils'
import { findExistingContact, isUniqueViolation } from '@/lib/contacts/dedupe'
import { runAutomationsForTrigger } from '@/lib/automations/engine'
import { dispatchInboundToFlows } from '@/lib/flows/engine'
import { dispatchInboundToAiReply } from '@/lib/ai/auto-reply'
import { dispatchWebhookEvent } from '@/lib/webhooks/deliver'
import type { NormalizedInboundMessage } from './types'

const ALLOWED_CONTENT_TYPES = new Set([
  'text',
  'image',
  'document',
  'audio',
  'video',
  'location',
  'template',
  'interactive',
])

type ContactRow = {
  id: string
  name?: string | null
  phone?: string | null
}

interface ContactOutcome {
  contact: ContactRow
  wasCreated: boolean
}

async function lookupInternalIdByProviderId(
  db: SupabaseClient,
  providerId: string,
  conversationId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('messages')
    .select('id')
    .eq('message_id', providerId)
    .eq('conversation_id', conversationId)
    .maybeSingle()
  if (error) return null
  return data?.id ?? null
}

async function flagBroadcastReplyIfAny(
  db: SupabaseClient,
  accountId: string,
  contactId: string,
): Promise<void> {
  try {
    const { data: recs, error } = await db
      .from('broadcast_recipients')
      .select('id, status, broadcast_id, broadcasts!inner(account_id)')
      .eq('contact_id', contactId)
      .eq('broadcasts.account_id', accountId)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !recs || recs.length === 0) return

    await db
      .from('broadcast_recipients')
      .update({ status: 'replied', replied_at: new Date().toISOString() })
      .eq('id', recs[0].id)
  } catch {
    // Best-effort
  }
}

export async function findOrCreateContact(
  db: SupabaseClient,
  accountId: string,
  configOwnerUserId: string,
  phone: string,
  name: string,
): Promise<ContactOutcome | null> {
  const existingContact = await findExistingContact(db, accountId, phone)

  if (existingContact) {
    if (name && name !== existingContact.name) {
      await db
        .from('contacts')
        .update({ name, updated_at: new Date().toISOString() })
        .eq('id', existingContact.id)
    }
    return { contact: existingContact, wasCreated: false }
  }

  const { data: newContact, error: createError } = await db
    .from('contacts')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      phone,
      name: name || phone,
    })
    .select()
    .single()

  if (createError) {
    if (isUniqueViolation(createError)) {
      const raced = await findExistingContact(db, accountId, phone)
      if (raced) return { contact: raced, wasCreated: false }
    }
    return null
  }

  return { contact: newContact, wasCreated: true }
}

export async function findOrCreateConversation(
  db: SupabaseClient,
  accountId: string,
  configOwnerUserId: string,
  contactId: string,
): Promise<{ conversation: { id: string; unread_count?: number | null }; created: boolean } | null> {
  const { data: existingRows, error: findError } = await db
    .from('conversations')
    .select('*')
    .eq('account_id', accountId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (findError) return null

  if (existingRows && existingRows.length > 0) {
    return { conversation: existingRows[0], created: false }
  }

  const { data: newConv, error: createError } = await db
    .from('conversations')
    .insert({
      account_id: accountId,
      user_id: configOwnerUserId,
      contact_id: contactId,
    })
    .select()
    .single()

  if (createError) {
    if (isUniqueViolation(createError)) {
      const { data: raced } = await db
        .from('conversations')
        .select('*')
        .eq('account_id', accountId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true })
        .limit(1)
      if (raced && raced.length > 0) {
        return { conversation: raced[0], created: false }
      }
    }
    return null
  }

  return { conversation: newConv, created: true }
}

/**
 * Persist a normalized inbound customer message and fan out to flows,
 * automations, AI reply, and public webhooks.
 */
export async function processNormalizedInboundMessage(
  db: SupabaseClient,
  inbound: NormalizedInboundMessage,
): Promise<void> {
  const senderPhone = normalizePhone(inbound.fromPhone)
  if (!senderPhone) return

  const contactOutcome = await findOrCreateContact(
    db,
    inbound.accountId,
    inbound.configOwnerUserId,
    senderPhone,
    inbound.contactName || senderPhone,
  )
  if (!contactOutcome) return
  const contactRecord = contactOutcome.contact

  const convResult = await findOrCreateConversation(
    db,
    inbound.accountId,
    inbound.configOwnerUserId,
    contactRecord.id,
  )
  if (!convResult) return
  const conversation = convResult.conversation

  if (convResult.created) {
    await dispatchWebhookEvent(db, inbound.accountId, 'conversation.created', {
      conversation_id: conversation.id,
      contact_id: contactRecord.id,
    })
  }

  let replyToInternalId: string | null = null
  if (inbound.replyToProviderMessageId) {
    replyToInternalId = await lookupInternalIdByProviderId(
      db,
      inbound.replyToProviderMessageId,
      conversation.id,
    )
  }

  const contentType = ALLOWED_CONTENT_TYPES.has(inbound.contentType)
    ? inbound.contentType
    : inbound.contentType === 'sticker'
      ? 'image'
      : 'text'

  const { count: priorCustomerMsgCount } = await db
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversation.id)
    .eq('sender_type', 'customer')
  const isFirstInboundMessage = (priorCustomerMsgCount ?? 0) === 0

  const createdAt = new Date(inbound.timestampMs).toISOString()

  const { error: msgError } = await db.from('messages').insert({
    conversation_id: conversation.id,
    sender_type: 'customer',
    content_type: contentType,
    content_text: inbound.contentText,
    media_url: inbound.mediaUrl,
    message_id: inbound.providerMessageId,
    status: 'delivered',
    created_at: createdAt,
    reply_to_message_id: replyToInternalId,
    interactive_reply_id: inbound.interactiveReplyId ?? null,
  })

  if (msgError) return

  await db
    .from('conversations')
    .update({
      last_message_text: inbound.contentText || `[${contentType}]`,
      last_message_at: new Date().toISOString(),
      unread_count: (conversation.unread_count || 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id)

  await flagBroadcastReplyIfAny(db, inbound.accountId, contactRecord.id)

  const interactiveReplyId = inbound.interactiveReplyId ?? null
  const flowResult = await dispatchInboundToFlows({
    accountId: inbound.accountId,
    userId: inbound.configOwnerUserId,
    contactId: contactRecord.id,
    conversationId: conversation.id,
    message: interactiveReplyId
      ? {
          kind: 'interactive_reply',
          reply_id: interactiveReplyId,
          reply_title: inbound.contentText ?? '',
          meta_message_id: inbound.providerMessageId,
        }
      : {
          kind: 'text',
          text: inbound.contentText ?? '',
          meta_message_id: inbound.providerMessageId,
        },
    isFirstInboundMessage,
  })
  const flowConsumed = flowResult.consumed

  const inboundText = inbound.contentText ?? ''
  const automationTriggers: (
    | 'new_contact_created'
    | 'first_inbound_message'
    | 'new_message_received'
    | 'keyword_match'
    | 'interactive_reply'
  )[] = []

  if (!flowConsumed) {
    automationTriggers.push('new_message_received', 'keyword_match')
    if (interactiveReplyId) {
      automationTriggers.push('interactive_reply')
    }
  }
  if (contactOutcome.wasCreated) automationTriggers.unshift('new_contact_created')
  if (isFirstInboundMessage) automationTriggers.unshift('first_inbound_message')

  for (const triggerType of automationTriggers) {
    void runAutomationsForTrigger({
      accountId: inbound.accountId,
      triggerType,
      contactId: contactRecord.id,
      context: {
        message_text: inboundText,
        conversation_id: conversation.id,
        interactive_reply_id: interactiveReplyId ?? undefined,
      },
    })
  }

  if (!flowConsumed && !interactiveReplyId && inboundText.trim()) {
    await dispatchInboundToAiReply({
      accountId: inbound.accountId,
      conversationId: conversation.id,
      contactId: contactRecord.id,
      configOwnerUserId: inbound.configOwnerUserId,
    })
  }

  await dispatchWebhookEvent(db, inbound.accountId, 'message.received', {
    conversation_id: conversation.id,
    contact_id: contactRecord.id,
    whatsapp_message_id: inbound.providerMessageId,
    content_type: contentType,
    text: inbound.contentText,
  })
}
