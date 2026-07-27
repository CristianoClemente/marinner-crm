import { decrypt } from '@/lib/whatsapp/encryption'
import {
  isMetaWhatsAppConfig,
  isWhatsAppProvider,
  isZapiWhatsAppConfig,
} from '@/lib/whatsapp/provider-guards'
import type { WhatsAppProvider } from '@/types'
import { createMetaProvider } from './meta'
import { createZapiProvider } from './zapi'
import type { ProviderFeature, WhatsAppMessagingProvider } from './types'
import { ProviderUnsupportedError } from './types'

export type { WhatsAppMessagingProvider, ProviderFeature, ProviderSendResult } from './types'
export { ProviderUnsupportedError } from './types'
export { createMetaProvider } from './meta'
export { createZapiProvider } from './zapi'

/** Row shape accepted from Supabase `whatsapp_config` selects. */
export type WhatsAppConfigRow = {
  provider?: WhatsAppProvider | string | null
  phone_number_id?: string | null
  access_token?: string | null
  zapi_instance_id?: string | null
  zapi_instance_token?: string | null
  zapi_client_token?: string | null
}

export function resolveConfigProvider(
  config: WhatsAppConfigRow,
): WhatsAppProvider {
  if (isWhatsAppProvider(config.provider)) return config.provider
  // Rows created before multi-provider support have no provider column
  // value in older clients; treat as Meta.
  return 'meta'
}

/**
 * Decrypt credentials from a `whatsapp_config` row and return the
 * matching messaging provider. Throws if the row is incomplete for
 * its provider.
 */
export function createWhatsAppProviderFromConfig(
  config: WhatsAppConfigRow,
): WhatsAppMessagingProvider {
  const provider = resolveConfigProvider(config)

  if (provider === 'zapi') {
    const row = {
      provider: 'zapi' as const,
      zapi_instance_id: config.zapi_instance_id ?? undefined,
      zapi_instance_token: config.zapi_instance_token ?? undefined,
      zapi_client_token: config.zapi_client_token ?? undefined,
    }
    if (!isZapiWhatsAppConfig(row)) {
      throw new Error(
        'Configuração Z-API incompleta (instance id / tokens obrigatórios)',
      )
    }
    return createZapiProvider({
      instanceId: row.zapi_instance_id,
      instanceToken: decrypt(row.zapi_instance_token),
      clientToken: decrypt(row.zapi_client_token),
    })
  }

  const row = {
    provider: 'meta' as const,
    phone_number_id: config.phone_number_id ?? undefined,
    access_token: config.access_token ?? undefined,
  }
  if (!isMetaWhatsAppConfig(row)) {
    throw new Error(
      'Configuração Meta incompleta (phone_number_id / access_token obrigatórios)',
    )
  }
  return createMetaProvider({
    phoneNumberId: row.phone_number_id,
    accessToken: decrypt(row.access_token),
  })
}

export function assertProviderSupports(
  messaging: WhatsAppMessagingProvider,
  feature: ProviderFeature,
): void {
  if (!messaging.supports(feature)) {
    throw new ProviderUnsupportedError(messaging.kind, feature)
  }
}
