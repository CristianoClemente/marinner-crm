/**
 * Provider-agnostic inbound message shape. Meta and Z-API webhooks
 * normalize into this before persistence + flow/automation dispatch.
 */
export interface NormalizedInboundMessage {
  accountId: string
  configOwnerUserId: string
  /** Provider message id stored on `messages.message_id`. */
  providerMessageId: string
  fromPhone: string
  contactName: string
  /** Unix epoch milliseconds. */
  timestampMs: number
  contentType: string
  contentText: string | null
  mediaUrl: string | null
  replyToProviderMessageId?: string | null
  interactiveReplyId?: string | null
}

export interface MessageStatusEvent {
  providerMessageId: string
  /** Internal ladder: pending | sent | delivered | read | failed */
  status: string
  /** Unix epoch milliseconds (or seconds — normalized in apply). */
  timestampMs: number
}
