import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadZapiCredentialsForAccount,
  requireAccount,
  zapiProviderFromCreds,
} from '../_shared'

/**
 * GET /api/whatsapp/zapi/status
 * Live connection status from Z-API + mirrors onto whatsapp_config.status.
 */
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAccount(supabase)
  if (!auth.ok) return auth.response

  const creds = await loadZapiCredentialsForAccount(supabase, auth.accountId)
  if (!creds.ok) {
    return NextResponse.json(
      { connected: false, reason: 'no_config', message: creds.error },
      { status: 200 },
    )
  }

  try {
    const provider = zapiProviderFromCreds(creds)
    const status = await provider.getConnectionStatus()

    await supabase
      .from('whatsapp_config')
      .update({
        status: status.connected ? 'connected' : 'disconnected',
        connected_at: status.connected ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', auth.accountId)

    return NextResponse.json({
      connected: status.connected,
      provider: 'zapi',
      detail: status.detail,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro Z-API'
    return NextResponse.json(
      {
        connected: false,
        provider: 'zapi',
        reason: 'zapi_api_error',
        message,
      },
      { status: 200 },
    )
  }
}
