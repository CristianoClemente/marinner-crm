import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE } from '@/lib/format';

export default getRequestConfig(async () => {
  // Produto só em pt-BR — sem seletor de idioma / env.
  const messages = (await import(`../../messages/${DEFAULT_LOCALE}.json`))
    .default;

  return {
    locale: DEFAULT_LOCALE,
    messages,
  };
});
