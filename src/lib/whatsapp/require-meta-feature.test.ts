import { describe, expect, it } from 'vitest'
import { assertMetaFeature } from './require-meta-feature'
import { ProviderUnsupportedError } from './providers'

describe('assertMetaFeature', () => {
  it('permite Meta', () => {
    expect(() =>
      assertMetaFeature({ provider: 'meta' }, 'template'),
    ).not.toThrow()
  })

  it('bloqueia Z-API com provider_unsupported', () => {
    expect(() =>
      assertMetaFeature({ provider: 'zapi' }, 'broadcast'),
    ).toThrow(ProviderUnsupportedError)
  })
})
