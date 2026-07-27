import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadZapiCredentialsForAccount,
  requireAccount,
} from '../_shared'

/**
 * POST /api/whatsapp/zapi/disconnect
 * Disconnects the WhatsApp session on Z-API and marks config disconnected.
 */
export async function POST() {
  const supabase = await createClient()
  const auth = await requireAccount(supabase)
  if (!auth.ok) return auth.response

  const creds = await loadZapiCredentialsForAccount(supabase, auth.accountId)
  if (!creds.ok) {
    return NextResponse.json({ error: creds.error }, { status: creds.status })
  }

  const url = `https://api.z-api.io/instances/${encodeURIComponent(creds.instanceId)}/token/${encodeURIComponent(creds.instanceToken)}/disconnect`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Client-Token': creds.clientToken },
  })

  if (!response.ok) {
    let message = `Z-API disconnect error: ${response.status}`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // keep fallback
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }

  await supabase
    .from('whatsapp_config')
    .update({
      status: 'disconnected',
      connected_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', auth.accountId)

  return NextResponse.json({ success: true, connected: false })
}
