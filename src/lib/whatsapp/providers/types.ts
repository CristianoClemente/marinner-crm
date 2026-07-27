import type { MediaKind } from '@/lib/whatsapp/meta-api'
import type { WhatsAppProvider } from '@/types'

export type { MediaKind }

export type ProviderFeature =
  | 'text'
  | 'media'
  | 'template'
  | 'interactive'
  | 'reaction'
  | 'broadcast'

export interface ProviderSendResult {
  /** Provider message id persisted on `messages.message_id`. */
  providerMessageId: string
}

export interface ProviderConnectionStatus {
  connected: boolean
  /** Human-readable detail from the provider, when available. */
  detail?: string
}

export interface ProviderSendTextArgs {
  to: string
  text: string
  /** Provider message id being replied to (Meta wamid / Z-API messageId). */
  contextMessageId?: string
}

export interface ProviderSendMediaArgs {
  to: string
  kind: MediaKind
  link: string
  caption?: string
  filename?: string
  contextMessageId?: string
}

/**
 * Transport-agnostic WhatsApp messaging surface used by inbox send,
 * flows, and automations. Template/interactive stay Meta-only in the
 * MVP — callers must check `supports()` before invoking Meta helpers.
 */
export interface WhatsAppMessagingProvider {
  readonly kind: WhatsAppProvider
  supports(feature: ProviderFeature): boolean
  sendText(args: ProviderSendTextArgs): Promise<ProviderSendResult>
  sendMedia(args: ProviderSendMediaArgs): Promise<ProviderSendResult>
  getConnectionStatus(): Promise<ProviderConnectionStatus>
}

export class ProviderUnsupportedError extends Error {
  readonly code = 'provider_unsupported'
  readonly feature: ProviderFeature
  readonly provider: WhatsAppProvider

  constructor(provider: WhatsAppProvider, feature: ProviderFeature) {
    super(
      `O provedor "${provider}" não suporta ${feature} nesta versão. Use a API oficial da Meta.`,
    )
    this.name = 'ProviderUnsupportedError'
    this.feature = feature
    this.provider = provider
  }
}
