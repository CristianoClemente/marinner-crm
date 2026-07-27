import type { NormalizedInboundMessage } from '@/lib/whatsapp/inbound'

/** Raw Z-API webhook body (ReceivedCallback and related). */
export interface ZapiWebhookPayload {
  type?: string
  instanceId?: string
  messageId?: string
  phone?: string
  fromMe?: boolean
  isGroup?: boolean
  isNewsletter?: boolean
  momment?: number
  status?: string
  ids?: string[]
  connected?: boolean
  disconnected?: boolean
  error?: string
  senderName?: string
  chatName?: string
  text?: { message?: string }
  image?: { imageUrl?: string; caption?: string; mimeType?: string }
  video?: { videoUrl?: string; caption?: string; mimeType?: string }
  audio?: { audioUrl?: string; mimeType?: string }
  document?: {
    documentUrl?: string
    fileName?: string
    caption?: string
    mimeType?: string
  }
  location?: {
    latitude?: number
    longitude?: number
    name?: string
    address?: string
    url?: string
  }
  /** Present when the payload is a reply to another message. */
  referenceMessageId?: string
  quotedMsgId?: string
  [key: string]: unknown
}

export type ZapiNormalizeResult =
  | { kind: 'inbound'; message: Omit<NormalizedInboundMessage, 'accountId' | 'configOwnerUserId'> }
  | { kind: 'status'; providerMessageIds: string[]; status: string; timestampMs: number }
  | { kind: 'connected'; connected: boolean; phone?: string }
  | { kind: 'disconnected'; error?: string }
  | { kind: 'ignore'; reason: string }

function pickMedia(
  payload: ZapiWebhookPayload,
): { contentType: string; mediaUrl: string | null; contentText: string | null } | null {
  if (payload.image?.imageUrl) {
    return {
      contentType: 'image',
      mediaUrl: payload.image.imageUrl,
      contentText: payload.image.caption || null,
    }
  }
  if (payload.video?.videoUrl) {
    return {
      contentType: 'video',
      mediaUrl: payload.video.videoUrl,
      contentText: payload.video.caption || null,
    }
  }
  if (payload.audio?.audioUrl) {
    return {
      contentType: 'audio',
      mediaUrl: payload.audio.audioUrl,
      contentText: null,
    }
  }
  if (payload.document?.documentUrl) {
    return {
      contentType: 'document',
      mediaUrl: payload.document.documentUrl,
      contentText:
        payload.document.caption || payload.document.fileName || null,
    }
  }
  if (payload.location) {
    const loc = payload.location
    const locationText = [
      loc.name,
      loc.address,
      loc.latitude != null && loc.longitude != null
        ? `${loc.latitude},${loc.longitude}`
        : null,
    ]
      .filter(Boolean)
      .join(' - ')
    return {
      contentType: 'location',
      mediaUrl: null,
      contentText: locationText || null,
    }
  }
  if (payload.text?.message != null) {
    return {
      contentType: 'text',
      mediaUrl: null,
      contentText: payload.text.message,
    }
  }
  return null
}

/**
 * Classify and normalize a Z-API webhook payload into an internal event.
 * Does not resolve account — caller looks up config by instanceId.
 */
export function normalizeZapiWebhook(
  payload: ZapiWebhookPayload,
): ZapiNormalizeResult {
  const type = payload.type || ''

  if (type === 'ConnectedCallback' || payload.connected === true) {
    return {
      kind: 'connected',
      connected: payload.connected !== false,
      phone: payload.phone,
    }
  }

  if (type === 'DisconnectedCallback' || payload.disconnected === true) {
    return {
      kind: 'disconnected',
      error: payload.error,
    }
  }

  if (type === 'MessageStatusCallback' || type === 'DeliveryCallback') {
    const ids =
      payload.ids && payload.ids.length > 0
        ? payload.ids
        : payload.messageId
          ? [payload.messageId]
          : []
    if (!payload.status || ids.length === 0) {
      return { kind: 'ignore', reason: 'status_missing_ids' }
    }
    const timestampMs = payload.momment ?? Date.now()
    return {
      kind: 'status',
      providerMessageIds: ids,
      status: payload.status,
      timestampMs,
    }
  }

  if (type === 'ReceivedCallback' || payload.messageId) {
    if (payload.fromMe) {
      return { kind: 'ignore', reason: 'from_me' }
    }
    if (payload.isGroup || payload.isNewsletter) {
      return { kind: 'ignore', reason: 'group_or_newsletter' }
    }
    if (!payload.messageId || !payload.phone) {
      return { kind: 'ignore', reason: 'missing_message_or_phone' }
    }

    const media = pickMedia(payload)
    if (!media) {
      return { kind: 'ignore', reason: 'unsupported_content' }
    }

    const replyTo =
      payload.referenceMessageId || payload.quotedMsgId || null

    return {
      kind: 'inbound',
      message: {
        providerMessageId: payload.messageId,
        fromPhone: payload.phone,
        contactName: payload.senderName || payload.chatName || payload.phone,
        timestampMs: payload.momment ?? Date.now(),
        contentType: media.contentType,
        contentText: media.contentText,
        mediaUrl: media.mediaUrl,
        replyToProviderMessageId: replyTo,
      },
    }
  }

  return { kind: 'ignore', reason: `unknown_type:${type || 'none'}` }
}
