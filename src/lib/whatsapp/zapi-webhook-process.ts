import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyMessageStatusUpdate,
  mapZapiStatusToInternal,
  processNormalizedInboundMessage,
} from '@/lib/whatsapp/inbound'
import {
  normalizeZapiWebhook,
  type ZapiWebhookPayload,
} from '@/lib/whatsapp/zapi-webhook'

export interface ZapiConfigRow {
  id: string
  account_id: string
  user_id: string
  provider?: string | null
  status?: string | null
}

/**
 * Process one Z-API webhook payload for a resolved config row.
 */
export async function processZapiWebhookEvent(
  db: SupabaseClient,
  config: ZapiConfigRow,
  payload: ZapiWebhookPayload,
): Promise<{ handled: string }> {
  const event = normalizeZapiWebhook(payload)

  switch (event.kind) {
    case 'ignore':
      return { handled: `ignored:${event.reason}` }

    case 'connected': {
      await db
        .from('whatsapp_config')
        .update({
          status: 'connected',
          connected_at: new Date().toISOString(),
          last_registration_error: null,
        })
        .eq('id', config.id)
      return { handled: 'connected' }
    }

    case 'disconnected': {
      await db
        .from('whatsapp_config')
        .update({
          status: 'disconnected',
          last_registration_error: event.error ?? 'Device disconnected',
        })
        .eq('id', config.id)
      return { handled: 'disconnected' }
    }

    case 'status': {
      const internal = mapZapiStatusToInternal(event.status)
      if (!internal) return { handled: `ignored:unknown_status:${event.status}` }
      for (const id of event.providerMessageIds) {
        await applyMessageStatusUpdate(db, {
          providerMessageId: id,
          status: internal,
          timestampMs: event.timestampMs,
        })
      }
      return { handled: 'status' }
    }

    case 'inbound': {
      await processNormalizedInboundMessage(db, {
        ...event.message,
        accountId: config.account_id,
        configOwnerUserId: config.user_id,
      })
      return { handled: 'inbound' }
    }

    default:
      return { handled: 'ignored:unhandled' }
  }
}

/**
 * Point all Z-API webhooks at a single HTTPS URL.
 * Called after saving Z-API credentials (Phase 3 UI/API).
 */
export async function registerZapiWebhookUrl(args: {
  instanceId: string
  instanceToken: string
  clientToken: string
  webhookUrl: string
  notifySentByMe?: boolean
}): Promise<void> {
  const url = `https://api.z-api.io/instances/${encodeURIComponent(args.instanceId)}/token/${encodeURIComponent(args.instanceToken)}/update-every-webhooks`
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': args.clientToken,
    },
    body: JSON.stringify({
      value: args.webhookUrl,
      notifySentByMe: args.notifySentByMe ?? false,
    }),
  })
  if (!response.ok) {
    let message = `Z-API update-every-webhooks failed: ${response.status}`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // keep fallback
    }
    throw new Error(message)
  }
}
