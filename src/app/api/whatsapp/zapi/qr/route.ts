import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  loadZapiCredentialsForAccount,
  requireAccount,
} from '../_shared'

/**
 * GET /api/whatsapp/zapi/qr
 * Returns Z-API QR code image (base64) for the account's saved instance.
 */
export async function GET() {
  const supabase = await createClient()
  const auth = await requireAccount(supabase)
  if (!auth.ok) return auth.response

  const creds = await loadZapiCredentialsForAccount(supabase, auth.accountId)
  if (!creds.ok) {
    return NextResponse.json({ error: creds.error }, { status: creds.status })
  }

  const url = `https://api.z-api.io/instances/${encodeURIComponent(creds.instanceId)}/token/${encodeURIComponent(creds.instanceToken)}/qr-code/image`
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Client-Token': creds.clientToken },
  })

  if (!response.ok) {
    let message = `Z-API QR error: ${response.status}`
    try {
      const data = (await response.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // keep fallback
    }
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as {
      value?: string
      qrcode?: string
      challenge?: unknown
    }
    if (data.challenge) {
      return NextResponse.json({
        connected: false,
        challenge: data.challenge,
        message:
          'A instância pediu autenticação por chave de acesso (passkey). Conclua no painel Z-API.',
      })
    }
    const value = data.value || data.qrcode
    if (!value) {
      return NextResponse.json(
        { error: 'Z-API não retornou imagem do QR' },
        { status: 502 },
      )
    }
    return NextResponse.json({ value, connected: false })
  }

  // Some Z-API versions return raw image bytes
  const buffer = Buffer.from(await response.arrayBuffer())
  const base64 = `data:${contentType || 'image/png'};base64,${buffer.toString('base64')}`
  return NextResponse.json({ value: base64, connected: false })
}
