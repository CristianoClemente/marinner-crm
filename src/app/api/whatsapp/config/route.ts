import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import {
  registerPhoneNumber,
  subscribeWabaToApp,
  verifyPhoneNumber,
} from '@/lib/whatsapp/meta-api'
import { encrypt, decrypt } from '@/lib/whatsapp/encryption'
import { createZapiProvider } from '@/lib/whatsapp/providers'
import { isWhatsAppProvider } from '@/lib/whatsapp/provider-guards'
import { registerZapiWebhookUrl } from '@/lib/whatsapp/zapi-webhook-process'
import { getApexUrl } from '@/lib/domain'
import type { WhatsAppProvider } from '@/types'

async function resolveAccountId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data?.account_id) return null
  return data.account_id as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}

function publicAppOrigin(request: Request): string {
  // Prefer the canonical site URL (NEXT_PUBLIC_SITE_URL via getApexUrl).
  // NEXT_PUBLIC_APP_URL is kept as a legacy override for older deploys.
  const legacyAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (legacyAppUrl) {
    return legacyAppUrl.replace(/\/$/, '')
  }

  const apex = getApexUrl()
  const isLocalDefault =
    apex.includes('localhost') || apex.includes('127.0.0.1')
  if (!isLocalDefault) {
    return apex
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
  }
  return new URL(request.url).origin
}

function zapiWebhookUrl(request: Request): string {
  const base = `${publicAppOrigin(request)}/api/whatsapp/webhook/z-api`
  const secret = process.env.ZAPI_WEBHOOK_SECRET
  if (secret) {
    return `${base}?secret=${encodeURIComponent(secret)}`
  }
  return base
}

/**
 * GET /api/whatsapp/config
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_account',
          message: 'Your profile is not linked to an account.',
        },
        { status: 200 },
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select(
        'provider, phone_number_id, access_token, status, zapi_instance_id, zapi_instance_token, zapi_client_token',
      )
      .eq('account_id', accountId)
      .maybeSingle()

    if (configError) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'db_error',
          message: 'Failed to fetch configuration',
        },
        { status: 200 },
      )
    }

    if (!config) {
      return NextResponse.json(
        {
          connected: false,
          reason: 'no_config',
          message:
            'No WhatsApp configuration saved yet. Fill in the form and click Save Configuration.',
        },
        { status: 200 },
      )
    }

    const provider: WhatsAppProvider = isWhatsAppProvider(config.provider)
      ? config.provider
      : 'meta'

    if (provider === 'zapi') {
      try {
        if (
          !config.zapi_instance_id ||
          !config.zapi_instance_token ||
          !config.zapi_client_token
        ) {
          return NextResponse.json(
            {
              connected: false,
              provider: 'zapi',
              reason: 'no_config',
              message: 'Configuração Z-API incompleta.',
            },
            { status: 200 },
          )
        }
        const messaging = createZapiProvider({
          instanceId: config.zapi_instance_id,
          instanceToken: decrypt(config.zapi_instance_token),
          clientToken: decrypt(config.zapi_client_token),
        })
        const status = await messaging.getConnectionStatus()
        return NextResponse.json({
          connected: status.connected,
          provider: 'zapi',
          detail: status.detail,
          instance_id: config.zapi_instance_id,
        })
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown Z-API error'
        const needsReset = /decrypt|ENCRYPTION/i.test(message)
        return NextResponse.json(
          {
            connected: false,
            provider: 'zapi',
            reason: needsReset ? 'token_corrupted' : 'zapi_api_error',
            needs_reset: needsReset,
            message,
          },
          { status: 200 },
        )
      }
    }

    // Meta path
    let accessToken: string
    try {
      if (!config.access_token || !config.phone_number_id) {
        return NextResponse.json(
          {
            connected: false,
            provider: 'meta',
            reason: 'no_config',
            message: 'Configuração Meta incompleta.',
          },
          { status: 200 },
        )
      }
      accessToken = decrypt(config.access_token)
    } catch {
      return NextResponse.json(
        {
          connected: false,
          provider: 'meta',
          reason: 'token_corrupted',
          needs_reset: true,
          message:
            'The stored access token cannot be decrypted with the current ENCRYPTION_KEY. Click "Reset Configuration" below, then re-save.',
        },
        { status: 200 },
      )
    }

    try {
      const phoneInfo = await verifyPhoneNumber({
        phoneNumberId: config.phone_number_id,
        accessToken,
      })
      return NextResponse.json({
        connected: true,
        provider: 'meta',
        phone_info: phoneInfo,
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json(
        {
          connected: false,
          provider: 'meta',
          reason: 'meta_api_error',
          message: `Meta API rejected the credentials: ${message}`,
        },
        { status: 200 },
      )
    }
  } catch {
    return NextResponse.json(
      {
        connected: false,
        reason: 'unknown',
        message: 'Internal server error',
      },
      { status: 500 },
    )
  }
}

/**
 * POST /api/whatsapp/config
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const body = await request.json()
    const providerRaw = body.provider ?? 'meta'
    if (!isWhatsAppProvider(providerRaw)) {
      return NextResponse.json(
        { error: 'provider deve ser "meta" ou "zapi"' },
        { status: 400 },
      )
    }

    if (providerRaw === 'zapi') {
      return saveZapiConfig({
        request,
        supabase,
        accountId,
        userId: user.id,
        body,
      })
    }

    return saveMetaConfig({
      supabase,
      accountId,
      userId: user.id,
      body,
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function saveZapiConfig(args: {
  request: Request
  supabase: Awaited<ReturnType<typeof createClient>>
  accountId: string
  userId: string
  body: Record<string, unknown>
}): Promise<NextResponse> {
  const { request, supabase, accountId, userId, body } = args

  const instanceId =
    typeof body.zapi_instance_id === 'string'
      ? body.zapi_instance_id.trim()
      : ''
  if (!instanceId) {
    return NextResponse.json(
      { error: 'zapi_instance_id é obrigatório' },
      { status: 400 },
    )
  }

  const { data: existing } = await supabase
    .from('whatsapp_config')
    .select(
      'id, provider, zapi_instance_id, zapi_instance_token, zapi_client_token',
    )
    .eq('account_id', accountId)
    .maybeSingle()

  let instanceToken =
    typeof body.zapi_instance_token === 'string'
      ? body.zapi_instance_token.trim()
      : ''
  let clientToken =
    typeof body.zapi_client_token === 'string'
      ? body.zapi_client_token.trim()
      : ''

  // Reuse stored tokens when the UI sends masked / empty values.
  if (
    (!instanceToken || instanceToken.includes('•')) &&
    existing?.provider === 'zapi' &&
    existing.zapi_instance_token
  ) {
    try {
      instanceToken = decrypt(existing.zapi_instance_token)
    } catch {
      return NextResponse.json(
        { error: 'Token da instância corrompido. Digite novamente.' },
        { status: 400 },
      )
    }
  }
  if (
    (!clientToken || clientToken.includes('•')) &&
    existing?.provider === 'zapi' &&
    existing.zapi_client_token
  ) {
    try {
      clientToken = decrypt(existing.zapi_client_token)
    } catch {
      return NextResponse.json(
        { error: 'Client-Token corrompido. Digite novamente.' },
        { status: 400 },
      )
    }
  }

  if (!instanceToken || !clientToken) {
    return NextResponse.json(
      {
        error:
          'zapi_instance_token e zapi_client_token são obrigatórios na configuração inicial',
      },
      { status: 400 },
    )
  }

  // Unique instance across accounts
  const { data: claimed } = await supabaseAdmin()
    .from('whatsapp_config')
    .select('account_id')
    .eq('zapi_instance_id', instanceId)
    .neq('account_id', accountId)
    .maybeSingle()

  if (claimed) {
    return NextResponse.json(
      {
        error:
          'Esta instância Z-API já está vinculada a outra conta nesta aplicação.',
      },
      { status: 409 },
    )
  }

  // Validate credentials with Z-API status
  let connected = false
  let detail: string | undefined
  try {
    const status = await createZapiProvider({
      instanceId,
      instanceToken,
      clientToken,
    }).getConnectionStatus()
    connected = status.connected
    detail = status.detail
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro Z-API'
    return NextResponse.json(
      { error: `Z-API rejeitou as credenciais: ${message}` },
      { status: 400 },
    )
  }

  let encryptedInstanceToken: string
  let encryptedClientToken: string
  try {
    encryptedInstanceToken = encrypt(instanceToken)
    encryptedClientToken = encrypt(clientToken)
  } catch {
    return NextResponse.json(
      {
        error:
          'Falha ao criptografar tokens. Verifique ENCRYPTION_KEY (64 hex).',
      },
      { status: 500 },
    )
  }

  // Register webhooks (best-effort — credentials still save if this fails)
  let webhookError: string | null = null
  try {
    await registerZapiWebhookUrl({
      instanceId,
      instanceToken,
      clientToken,
      webhookUrl: zapiWebhookUrl(request),
      notifySentByMe: false,
    })
  } catch (err) {
    webhookError = err instanceof Error ? err.message : 'Falha ao registrar webhooks'
  }

  const row = {
    provider: 'zapi' as const,
    // Clear Meta-only credentials (CHECK constraint)
    phone_number_id: null,
    waba_id: null,
    access_token: null,
    verify_token: null,
    registered_at: null,
    subscribed_apps_at: null,
    last_registration_error: webhookError,
    zapi_instance_id: instanceId,
    zapi_instance_token: encryptedInstanceToken,
    zapi_client_token: encryptedClientToken,
    status: connected ? 'connected' : 'disconnected',
    connected_at: connected ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update(row)
      .eq('account_id', accountId)
    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update configuration' },
        { status: 500 },
      )
    }
  } else {
    const { error: insertError } = await supabase.from('whatsapp_config').insert({
      account_id: accountId,
      user_id: userId,
      ...row,
    })
    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to save configuration' },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({
    success: true,
    saved: true,
    provider: 'zapi',
    connected,
    detail,
    webhook_url: zapiWebhookUrl(request),
    webhook_error: webhookError,
    needs_qr: !connected,
  })
}

async function saveMetaConfig(args: {
  supabase: Awaited<ReturnType<typeof createClient>>
  accountId: string
  userId: string
  body: Record<string, unknown>
}): Promise<NextResponse> {
  const { supabase, accountId, userId, body } = args
  const phone_number_id =
    typeof body.phone_number_id === 'string' ? body.phone_number_id.trim() : ''
  const waba_id =
    typeof body.waba_id === 'string' ? body.waba_id.trim() : ''
  const access_token =
    typeof body.access_token === 'string' ? body.access_token.trim() : ''
  const verify_token =
    typeof body.verify_token === 'string' ? body.verify_token.trim() : ''
  const pin = body.pin

  if (!access_token || !phone_number_id) {
    return NextResponse.json(
      { error: 'access_token and phone_number_id are required' },
      { status: 400 },
    )
  }

  if (pin !== undefined && pin !== null && pin !== '') {
    if (typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be exactly 6 digits.' },
        { status: 400 },
      )
    }
  }

  const { data: claimed, error: claimedError } = await supabaseAdmin()
    .from('whatsapp_config')
    .select('account_id')
    .eq('phone_number_id', phone_number_id)
    .neq('account_id', accountId)
    .maybeSingle()

  if (claimedError) {
    return NextResponse.json(
      { error: 'Failed to validate configuration' },
      { status: 500 },
    )
  }

  if (claimed) {
    return NextResponse.json(
      {
        error:
          'Este número do WhatsApp já está vinculado a outra conta nesta instância. Cada número só pode ser conectado a uma conta Marinner.',
      },
      { status: 409 },
    )
  }

  let phoneInfo
  try {
    phoneInfo = await verifyPhoneNumber({
      phoneNumberId: phone_number_id,
      accessToken: access_token,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown Meta API error'
    return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 400 })
  }

  let encryptedAccessToken: string
  let encryptedVerifyToken: string | null
  try {
    encryptedAccessToken = encrypt(access_token)
    encryptedVerifyToken = verify_token ? encrypt(verify_token) : null
  } catch {
    return NextResponse.json(
      {
        error:
          'Failed to encrypt token. Check that ENCRYPTION_KEY is a valid 64-character hex string in your environment variables.',
      },
      { status: 500 },
    )
  }

  const { data: existing } = await supabase
    .from('whatsapp_config')
    .select('id, registered_at, phone_number_id')
    .eq('account_id', accountId)
    .maybeSingle()

  const sameNumber =
    existing?.phone_number_id === phone_number_id &&
    existing?.registered_at != null

  let registeredAt: string | null = existing?.registered_at ?? null
  let registrationError: string | null = null
  let registrationSkipped = false

  const needsRegistration =
    !sameNumber || (typeof pin === 'string' && pin.length > 0)
  if (needsRegistration) {
    if (!pin) {
      registrationSkipped = true
    } else {
      try {
        await registerPhoneNumber({
          phoneNumberId: phone_number_id,
          accessToken: access_token,
          pin: pin as string,
        })
        registeredAt = new Date().toISOString()
      } catch (err) {
        registrationError =
          err instanceof Error ? err.message : 'Unknown Meta API error'
      }
    }
  }

  let subscribedAppsAt: string | null = null
  if (waba_id) {
    try {
      await subscribeWabaToApp({
        wabaId: waba_id,
        accessToken: access_token,
      })
      subscribedAppsAt = new Date().toISOString()
    } catch {
      // non-fatal
    }
  }

  const baseRow = {
    provider: 'meta' as const,
    phone_number_id,
    waba_id: waba_id || null,
    access_token: encryptedAccessToken,
    verify_token: encryptedVerifyToken,
    // Clear Z-API credentials
    zapi_instance_id: null,
    zapi_instance_token: null,
    zapi_client_token: null,
    status: registrationError ? 'disconnected' : 'connected',
    connected_at: registrationError ? null : new Date().toISOString(),
    registered_at: registrationError ? null : registeredAt,
    subscribed_apps_at: subscribedAppsAt ?? null,
    last_registration_error: registrationError,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update(baseRow)
      .eq('account_id', accountId)

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update configuration' },
        { status: 500 },
      )
    }
  } else {
    const { error: insertError } = await supabase.from('whatsapp_config').insert({
      account_id: accountId,
      user_id: userId,
      ...baseRow,
    })

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to save configuration' },
        { status: 500 },
      )
    }
  }

  if (registrationError) {
    return NextResponse.json({
      success: false,
      saved: true,
      provider: 'meta',
      registered: false,
      registration_error: registrationError,
      phone_info: phoneInfo,
    })
  }

  return NextResponse.json({
    success: true,
    saved: true,
    provider: 'meta',
    registered: registeredAt != null,
    registration_skipped: registrationSkipped,
    phone_info: phoneInfo,
  })
}

/**
 * DELETE /api/whatsapp/config
 */
export async function DELETE() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accountId = await resolveAccountId(supabase, user.id)
    if (!accountId) {
      return NextResponse.json(
        { error: 'Your profile is not linked to an account.' },
        { status: 403 },
      )
    }

    const { error: deleteError } = await supabase
      .from('whatsapp_config')
      .delete()
      .eq('account_id', accountId)

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete configuration' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
