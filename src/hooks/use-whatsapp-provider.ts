'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { isWhatsAppProvider } from '@/lib/whatsapp/provider-guards'
import type { WhatsAppProvider } from '@/types'

type WhatsAppProviderState = {
  provider: WhatsAppProvider | null
  status: string | null
  loading: boolean
  isZapi: boolean
  isMeta: boolean
}

/**
 * Lightweight account-scoped WhatsApp provider for UI feature gates.
 * Does not decrypt tokens or call provider health APIs.
 */
export function useWhatsAppProvider(): WhatsAppProviderState {
  const { accountId } = useAuth()
  const [provider, setProvider] = useState<WhatsAppProvider | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accountId) {
      setProvider(null)
      setStatus(null)
      setLoading(false)
      return
    }

    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('whatsapp_config')
        .select('provider, status')
        .eq('account_id', accountId)
        .maybeSingle()

      if (cancelled) return

      const raw = data?.provider
      setProvider(isWhatsAppProvider(raw) ? raw : data ? 'meta' : null)
      setStatus(typeof data?.status === 'string' ? data.status : null)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [accountId])

  return {
    provider,
    status,
    loading,
    isZapi: provider === 'zapi',
    isMeta: provider === 'meta',
  }
}
