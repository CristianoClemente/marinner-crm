import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/whatsapp/encryption'
import { createZapiProvider } from '@/lib/whatsapp/providers'
import { isZapiWhatsAppConfig } from '@/lib/whatsapp/provider-guards'

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

export async function loadZapiCredentialsForAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountId: string,
): Promise<
  | { ok: true; instanceId: string; instanceToken: string; clientToken: string }
  | {
      ok: false
      status: number
      error: string
      reason: 'missing' | 'wrong_provider' | 'token_corrupted'
      needs_reset?: boolean
    }
> {
  const { data: config, error } = await supabase
    .from('whatsapp_config')
    .select(
      'provider, zapi_instance_id, zapi_instance_token, zapi_client_token',
    )
    .eq('account_id', accountId)
    .maybeSingle()

  if (error || !config) {
    return {
      ok: false,
      status: 404,
      error: 'Configuração Z-API não encontrada',
      reason: 'missing',
    }
  }

  const row = {
    provider: (config.provider ?? 'meta') as 'meta' | 'zapi',
    zapi_instance_id: config.zapi_instance_id ?? undefined,
    zapi_instance_token: config.zapi_instance_token ?? undefined,
    zapi_client_token: config.zapi_client_token ?? undefined,
  }

  if (!isZapiWhatsAppConfig(row)) {
    return {
      ok: false,
      status: 400,
      error: 'Esta conta não está configurada com Z-API',
      reason: 'wrong_provider',
    }
  }

  try {
    return {
      ok: true,
      instanceId: row.zapi_instance_id,
      instanceToken: decrypt(row.zapi_instance_token),
      clientToken: decrypt(row.zapi_client_token),
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error:
        'Não foi possível descriptografar os tokens Z-API. Digite-os de novo e salve.',
      reason: 'token_corrupted',
      needs_reset: true,
    }
  }
}

export async function requireAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<
  | { ok: true; userId: string; accountId: string }
  | { ok: false; response: NextResponse }
> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const accountId = await resolveAccountId(supabase, user.id)
  if (!accountId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Perfil sem conta vinculada' },
        { status: 403 },
      ),
    }
  }

  return { ok: true, userId: user.id, accountId }
}

export function zapiProviderFromCreds(creds: {
  instanceId: string
  instanceToken: string
  clientToken: string
}) {
  return createZapiProvider(creds)
}
