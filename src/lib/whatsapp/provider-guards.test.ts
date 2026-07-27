import { describe, expect, it } from 'vitest';
import {
  isMetaWhatsAppConfig,
  isWhatsAppProvider,
  isZapiWhatsAppConfig,
} from './provider-guards';

describe('provider-guards', () => {
  it('isWhatsAppProvider aceita apenas meta e zapi', () => {
    expect(isWhatsAppProvider('meta')).toBe(true);
    expect(isWhatsAppProvider('zapi')).toBe(true);
    expect(isWhatsAppProvider('twilio')).toBe(false);
    expect(isWhatsAppProvider(null)).toBe(false);
  });

  it('isMetaWhatsAppConfig exige credenciais Meta', () => {
    expect(
      isMetaWhatsAppConfig({
        provider: 'meta',
        phone_number_id: '123',
        access_token: 'tok',
      }),
    ).toBe(true);
    expect(
      isMetaWhatsAppConfig({
        provider: 'meta',
        phone_number_id: undefined,
        access_token: 'tok',
      }),
    ).toBe(false);
    expect(
      isMetaWhatsAppConfig({
        provider: 'zapi',
        phone_number_id: '123',
        access_token: 'tok',
      }),
    ).toBe(false);
  });

  it('isZapiWhatsAppConfig exige instance + tokens', () => {
    expect(
      isZapiWhatsAppConfig({
        provider: 'zapi',
        zapi_instance_id: 'inst',
        zapi_instance_token: 'itok',
        zapi_client_token: 'ctok',
      }),
    ).toBe(true);
    expect(
      isZapiWhatsAppConfig({
        provider: 'zapi',
        zapi_instance_id: 'inst',
        zapi_instance_token: 'itok',
        zapi_client_token: undefined,
      }),
    ).toBe(false);
    expect(
      isZapiWhatsAppConfig({
        provider: 'meta',
        zapi_instance_id: 'inst',
        zapi_instance_token: 'itok',
        zapi_client_token: 'ctok',
      }),
    ).toBe(false);
  });
});
