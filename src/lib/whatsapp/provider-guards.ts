import type { WhatsAppConfig, WhatsAppProvider } from '@/types';

export function isWhatsAppProvider(value: unknown): value is WhatsAppProvider {
  return value === 'meta' || value === 'zapi';
}

/** Narrow a config row to Meta credentials (phone_number_id + access_token). */
export function isMetaWhatsAppConfig(
  config: Pick<
    WhatsAppConfig,
    'provider' | 'phone_number_id' | 'access_token'
  >,
): config is Pick<WhatsAppConfig, 'provider' | 'phone_number_id' | 'access_token'> & {
  provider: 'meta';
  phone_number_id: string;
  access_token: string;
} {
  return (
    config.provider === 'meta' &&
    typeof config.phone_number_id === 'string' &&
    config.phone_number_id.length > 0 &&
    typeof config.access_token === 'string' &&
    config.access_token.length > 0
  );
}

/** Narrow a config row to Z-API credentials (instance + tokens). */
export function isZapiWhatsAppConfig(
  config: Pick<
    WhatsAppConfig,
    | 'provider'
    | 'zapi_instance_id'
    | 'zapi_instance_token'
    | 'zapi_client_token'
  >,
): config is Pick<
  WhatsAppConfig,
  'provider' | 'zapi_instance_id' | 'zapi_instance_token' | 'zapi_client_token'
> & {
  provider: 'zapi';
  zapi_instance_id: string;
  zapi_instance_token: string;
  zapi_client_token: string;
} {
  return (
    config.provider === 'zapi' &&
    typeof config.zapi_instance_id === 'string' &&
    config.zapi_instance_id.length > 0 &&
    typeof config.zapi_instance_token === 'string' &&
    config.zapi_instance_token.length > 0 &&
    typeof config.zapi_client_token === 'string' &&
    config.zapi_client_token.length > 0
  );
}
