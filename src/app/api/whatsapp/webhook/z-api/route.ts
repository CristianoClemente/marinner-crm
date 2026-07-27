import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processZapiWebhookEvent } from '@/lib/whatsapp/zapi-webhook-process'
import type { ZapiWebhookPayload } from '@/lib/whatsapp/zapi-webhook'

export const maxDuration = 60

// Lazy-initialized to avoid build-time crash when env vars are missing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

/**
 * Optional shared secret: when `ZAPI_WEBHOOK_SECRET` is set in the
 * environment, callers must pass `?secret=` with the same value.
 * Instance id is always required (body or query) to resolve the account.
 */
function assertWebhookSecret(request: Request): NextResponse | null {
  const expected = process.env.ZAPI_WEBHOOK_SECRET
  if (!expected) return null
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  if (secret !== expected) {
    return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 })
  }
  return null
}

function extractInstanceId(
  payload: ZapiWebhookPayload,
  request: Request,
): string | null {
  if (typeof payload.instanceId === 'string' && payload.instanceId.length > 0) {
    return payload.instanceId
  }
  const { searchParams } = new URL(request.url)
  const fromQuery = searchParams.get('instance')
  return fromQuery && fromQuery.length > 0 ? fromQuery : null
}

export async function POST(request: Request) {
  const secretError = assertWebhookSecret(request)
  if (secretError) return secretError

  let payload: ZapiWebhookPayload
  try {
    payload = (await request.json()) as ZapiWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const instanceId = extractInstanceId(payload, request)
  if (!instanceId) {
    return NextResponse.json(
      { error: 'instanceId is required' },
      { status: 400 },
    )
  }

  const db = supabaseAdmin()
  const { data: config, error } = await db
    .from('whatsapp_config')
    .select('id, account_id, user_id, provider, status')
    .eq('zapi_instance_id', instanceId)
    .eq('provider', 'zapi')
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'config_lookup_failed' },
      { status: 500 },
    )
  }

  if (!config) {
    return NextResponse.json(
      { error: 'unknown_instance' },
      { status: 404 },
    )
  }

  try {
    const result = await processZapiWebhookEvent(db, config, {
      ...payload,
      instanceId,
    })
    return NextResponse.json(
      { status: 'received', handled: result.handled },
      { status: 200 },
    )
  } catch {
    return NextResponse.json(
      { error: 'processing_failed' },
      { status: 500 },
    )
  }
}
