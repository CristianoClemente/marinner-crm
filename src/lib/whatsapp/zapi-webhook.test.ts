import { describe, expect, it } from 'vitest'
import { normalizeZapiWebhook } from './zapi-webhook'
import {
  isValidStatusTransition,
  mapZapiStatusToInternal,
} from './inbound/status'

describe('normalizeZapiWebhook', () => {
  it('normaliza texto ReceivedCallback', () => {
    const result = normalizeZapiWebhook({
      type: 'ReceivedCallback',
      instanceId: 'INST',
      messageId: 'MSG-1',
      phone: '5511999999999',
      fromMe: false,
      momment: 1632228638000,
      senderName: 'Maria',
      text: { message: 'olá' },
    })
    expect(result.kind).toBe('inbound')
    if (result.kind === 'inbound') {
      expect(result.message.contentType).toBe('text')
      expect(result.message.contentText).toBe('olá')
      expect(result.message.fromPhone).toBe('5511999999999')
      expect(result.message.providerMessageId).toBe('MSG-1')
    }
  })

  it('normaliza imagem com URL pública', () => {
    const result = normalizeZapiWebhook({
      type: 'ReceivedCallback',
      messageId: 'IMG-1',
      phone: '5511888888888',
      fromMe: false,
      image: {
        imageUrl: 'https://cdn.z-api.io/img.jpg',
        caption: 'foto',
      },
    })
    expect(result.kind).toBe('inbound')
    if (result.kind === 'inbound') {
      expect(result.message.contentType).toBe('image')
      expect(result.message.mediaUrl).toBe('https://cdn.z-api.io/img.jpg')
      expect(result.message.contentText).toBe('foto')
    }
  })

  it('ignora fromMe, grupos e newsletters', () => {
    expect(
      normalizeZapiWebhook({
        type: 'ReceivedCallback',
        messageId: 'M',
        phone: '55',
        fromMe: true,
        text: { message: 'x' },
      }).kind,
    ).toBe('ignore')
    expect(
      normalizeZapiWebhook({
        type: 'ReceivedCallback',
        messageId: 'M',
        phone: '55',
        isGroup: true,
        text: { message: 'x' },
      }).kind,
    ).toBe('ignore')
  })

  it('mapeia MessageStatusCallback', () => {
    const result = normalizeZapiWebhook({
      type: 'MessageStatusCallback',
      status: 'READ',
      ids: ['A', 'B'],
      momment: 1000,
    })
    expect(result).toEqual({
      kind: 'status',
      providerMessageIds: ['A', 'B'],
      status: 'READ',
      timestampMs: 1000,
    })
  })

  it('mapeia ConnectedCallback e DisconnectedCallback', () => {
    expect(
      normalizeZapiWebhook({
        type: 'ConnectedCallback',
        connected: true,
        phone: '5544',
      }),
    ).toMatchObject({ kind: 'connected', connected: true })
    expect(
      normalizeZapiWebhook({
        type: 'DisconnectedCallback',
        disconnected: true,
        error: 'Device has been disconnected',
      }),
    ).toMatchObject({ kind: 'disconnected' })
  })
})

describe('mapZapiStatusToInternal', () => {
  it('mapeia statuses Z-API para ladder interna', () => {
    expect(mapZapiStatusToInternal('SENT')).toBe('sent')
    expect(mapZapiStatusToInternal('RECEIVED')).toBe('delivered')
    expect(mapZapiStatusToInternal('READ')).toBe('read')
    expect(mapZapiStatusToInternal('PLAYED')).toBe('read')
    expect(mapZapiStatusToInternal('FAILED')).toBe('failed')
    expect(mapZapiStatusToInternal('WTF')).toBeNull()
  })
})

describe('isValidStatusTransition', () => {
  it('só avança na ladder e limita failed', () => {
    expect(isValidStatusTransition('sent', 'delivered')).toBe(true)
    expect(isValidStatusTransition('read', 'sent')).toBe(false)
    expect(isValidStatusTransition('sent', 'failed')).toBe(true)
    expect(isValidStatusTransition('delivered', 'failed')).toBe(false)
  })
})
