import {
  sendMediaMessage,
  sendTextMessage,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import type {
  ProviderConnectionStatus,
  ProviderFeature,
  ProviderSendMediaArgs,
  ProviderSendResult,
  ProviderSendTextArgs,
  WhatsAppMessagingProvider,
} from './types'

export interface MetaProviderCredentials {
  phoneNumberId: string
  accessToken: string
}

export function createMetaProvider(
  creds: MetaProviderCredentials,
): WhatsAppMessagingProvider {
  const { phoneNumberId, accessToken } = creds

  return {
    kind: 'meta',

    supports(feature: ProviderFeature): boolean {
      return (
        feature === 'text' ||
        feature === 'media' ||
        feature === 'template' ||
        feature === 'interactive' ||
        feature === 'reaction' ||
        feature === 'broadcast'
      )
    },

    async sendText(args: ProviderSendTextArgs): Promise<ProviderSendResult> {
      const result = await sendTextMessage({
        phoneNumberId,
        accessToken,
        to: args.to,
        text: args.text,
        contextMessageId: args.contextMessageId,
      })
      return { providerMessageId: result.messageId }
    },

    async sendMedia(args: ProviderSendMediaArgs): Promise<ProviderSendResult> {
      const result = await sendMediaMessage({
        phoneNumberId,
        accessToken,
        to: args.to,
        kind: args.kind,
        link: args.link,
        caption: args.caption,
        filename: args.filename,
        contextMessageId: args.contextMessageId,
      })
      return { providerMessageId: result.messageId }
    },

    async getConnectionStatus(): Promise<ProviderConnectionStatus> {
      try {
        const info = await verifyPhoneNumber({ phoneNumberId, accessToken })
        return {
          connected: true,
          detail: info.display_phone_number || info.verified_name,
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'Meta verification failed'
        return { connected: false, detail }
      }
    },
  }
}
