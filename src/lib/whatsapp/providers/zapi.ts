import type {
  ProviderConnectionStatus,
  ProviderFeature,
  ProviderSendMediaArgs,
  ProviderSendResult,
  ProviderSendTextArgs,
  WhatsAppMessagingProvider,
} from './types'
import type { MediaKind } from './types'

const ZAPI_BASE = 'https://api.z-api.io'

export interface ZapiProviderCredentials {
  instanceId: string
  instanceToken: string
  clientToken: string
}

interface ZapiSendResponse {
  messageId?: string
  id?: string
  zaapId?: string
  error?: string
}

interface ZapiStatusResponse {
  connected?: boolean
  smartphoneConnected?: boolean
  error?: string
}

const MEDIA_PATH: Record<MediaKind, string> = {
  image: 'send-image',
  video: 'send-video',
  document: 'send-document',
  audio: 'send-audio',
}

function zapiUrl(
  creds: ZapiProviderCredentials,
  path: string,
): string {
  return `${ZAPI_BASE}/instances/${encodeURIComponent(creds.instanceId)}/token/${encodeURIComponent(creds.instanceToken)}/${path}`
}

async function throwZapiError(
  response: Response,
  fallback: string,
): Promise<never> {
  let message = fallback
  try {
    const data = (await response.json()) as { error?: string; message?: string }
    if (data.error) message = data.error
    else if (data.message) message = data.message
  } catch {
    // body wasn't JSON — keep fallback
  }
  throw new Error(message)
}

function pickMessageId(data: ZapiSendResponse): string {
  const id = data.messageId || data.id || data.zaapId
  if (!id) {
    throw new Error('Z-API não retornou messageId')
  }
  return id
}

async function zapiRequest(
  creds: ZapiProviderCredentials,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(zapiUrl(creds, path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': creds.clientToken,
      ...(init?.headers ?? {}),
    },
  })
}

export function createZapiProvider(
  creds: ZapiProviderCredentials,
): WhatsAppMessagingProvider {
  return {
    kind: 'zapi',

    supports(feature: ProviderFeature): boolean {
      return feature === 'text' || feature === 'media'
    },

    async sendText(args: ProviderSendTextArgs): Promise<ProviderSendResult> {
      const body: Record<string, unknown> = {
        phone: args.to,
        message: args.text,
      }
      if (args.contextMessageId) {
        body.messageId = args.contextMessageId
      }

      const response = await zapiRequest(creds, 'send-text', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        await throwZapiError(response, `Z-API error: ${response.status}`)
      }
      const data = (await response.json()) as ZapiSendResponse
      return { providerMessageId: pickMessageId(data) }
    },

    async sendMedia(args: ProviderSendMediaArgs): Promise<ProviderSendResult> {
      if (!args.link) {
        throw new Error('sendMedia requer uma URL de mídia')
      }

      const path = MEDIA_PATH[args.kind]
      const body: Record<string, unknown> = {
        phone: args.to,
      }

      if (args.kind === 'image') {
        body.image = args.link
        if (args.caption) body.caption = args.caption
      } else if (args.kind === 'video') {
        body.video = args.link
        if (args.caption) body.caption = args.caption
      } else if (args.kind === 'document') {
        body.document = args.link
        if (args.caption) body.caption = args.caption
        if (args.filename) body.fileName = args.filename
      } else {
        // audio
        body.audio = args.link
      }

      if (args.contextMessageId) {
        body.messageId = args.contextMessageId
      }

      const response = await zapiRequest(creds, path, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        await throwZapiError(response, `Z-API error: ${response.status}`)
      }
      const data = (await response.json()) as ZapiSendResponse
      return { providerMessageId: pickMessageId(data) }
    },

    async getConnectionStatus(): Promise<ProviderConnectionStatus> {
      const response = await zapiRequest(creds, 'status', { method: 'GET' })
      if (!response.ok) {
        await throwZapiError(response, `Z-API status error: ${response.status}`)
      }
      const data = (await response.json()) as ZapiStatusResponse
      // Algumas instâncias ficam `connected: true` com o celular offline
      // (`smartphoneConnected: false`) — nesse caso ainda precisamos do QR.
      const connected =
        Boolean(data.connected) && data.smartphoneConnected !== false
      const detailParts: string[] = []
      if (data.error) detailParts.push(data.error)
      if (data.smartphoneConnected === false) {
        detailParts.push('smartphone desconectado')
      }
      return {
        connected,
        detail: detailParts.length > 0 ? detailParts.join(' — ') : undefined,
      }
    },
  }
}
