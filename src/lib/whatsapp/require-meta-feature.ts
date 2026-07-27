import { NextResponse } from 'next/server'
import {
  resolveConfigProvider,
  type WhatsAppConfigRow,
} from '@/lib/whatsapp/providers'
import {
  ProviderUnsupportedError,
  type ProviderFeature,
} from '@/lib/whatsapp/providers/types'

/**
 * Returns a 400 JSON response when the account uses Z-API for a
 * Meta-only feature; otherwise null so the caller can continue.
 */
export function rejectUnlessMetaFeature(
  config: WhatsAppConfigRow,
  feature: ProviderFeature,
): NextResponse | null {
  if (resolveConfigProvider(config) !== 'zapi') return null
  const err = new ProviderUnsupportedError('zapi', feature)
  return NextResponse.json(
    {
      error: err.message,
      code: err.code,
      feature: err.feature,
    },
    { status: 400 },
  )
}

/** Throw-style guard for cores that don't return NextResponse. */
export function assertMetaFeature(
  config: WhatsAppConfigRow,
  feature: ProviderFeature,
): void {
  if (resolveConfigProvider(config) === 'zapi') {
    throw new ProviderUnsupportedError('zapi', feature)
  }
}
