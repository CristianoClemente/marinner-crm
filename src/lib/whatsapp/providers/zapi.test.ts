import { afterEach, describe, expect, it, vi } from 'vitest'
import { createZapiProvider } from './zapi'
import { createMetaProvider } from './meta'
import { ProviderUnsupportedError } from './types'
import {
  assertProviderSupports,
  createWhatsAppProviderFromConfig,
  resolveConfigProvider,
} from './index'
import { encrypt } from '@/lib/whatsapp/encryption'

const creds = {
  instanceId: 'inst-1',
  instanceToken: 'tok-1',
  clientToken: 'client-1',
}

describe('createZapiProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('supports apenas text e media', () => {
    const p = createZapiProvider(creds)
    expect(p.kind).toBe('zapi')
    expect(p.supports('text')).toBe(true)
    expect(p.supports('media')).toBe(true)
    expect(p.supports('template')).toBe(false)
    expect(p.supports('interactive')).toBe(false)
  })

  it('sendText monta URL, headers e body corretos', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: 'MSG-1', zaapId: 'ZAAP-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = createZapiProvider(creds)
    const result = await p.sendText({
      to: '5511999999999',
      text: 'Olá',
      contextMessageId: 'PARENT-1',
    })

    expect(result.providerMessageId).toBe('MSG-1')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(
      'https://api.z-api.io/instances/inst-1/token/tok-1/send-text',
    )
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['Client-Token']).toBe('client-1')
    expect(headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({
      phone: '5511999999999',
      message: 'Olá',
      messageId: 'PARENT-1',
    })
  })

  it('sendMedia image usa send-image com caption', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'IMG-1' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const p = createZapiProvider(creds)
    const result = await p.sendMedia({
      to: '5511888888888',
      kind: 'image',
      link: 'https://cdn.example/a.jpg',
      caption: 'foto',
    })

    expect(result.providerMessageId).toBe('IMG-1')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/send-image')
    expect(JSON.parse(String(init.body))).toEqual({
      phone: '5511888888888',
      image: 'https://cdn.example/a.jpg',
      caption: 'foto',
    })
  })

  it('getConnectionStatus lê connected da Z-API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          connected: true,
          smartphoneConnected: true,
          error: 'You are already connected',
        }),
      }),
    )

    const p = createZapiProvider(creds)
    const status = await p.getConnectionStatus()
    expect(status.connected).toBe(true)
    expect(status.detail).toContain('You are already connected')
  })

  it('propaga erro HTTP da Z-API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'null not allowed' }),
      }),
    )

    const p = createZapiProvider(creds)
    await expect(
      p.sendText({ to: '5511', text: 'x' }),
    ).rejects.toThrow(/null not allowed/)
  })
})

describe('createMetaProvider', () => {
  it('suporta template e interactive', () => {
    const p = createMetaProvider({
      phoneNumberId: 'pn',
      accessToken: 'at',
    })
    expect(p.supports('template')).toBe(true)
    expect(p.supports('interactive')).toBe(true)
  })
})

describe('createWhatsAppProviderFromConfig', () => {
  it('resolve provider ausente como meta', () => {
    expect(resolveConfigProvider({ provider: null })).toBe('meta')
    expect(resolveConfigProvider({})).toBe('meta')
  })

  it('monta provider Z-API a partir da row criptografada', () => {
    const p = createWhatsAppProviderFromConfig({
      provider: 'zapi',
      zapi_instance_id: 'i1',
      zapi_instance_token: encrypt('itok'),
      zapi_client_token: encrypt('ctok'),
    })
    expect(p.kind).toBe('zapi')
  })

  it('assertProviderSupports lança provider_unsupported', () => {
    const p = createZapiProvider(creds)
    expect(() => assertProviderSupports(p, 'template')).toThrow(
      ProviderUnsupportedError,
    )
  })
})
