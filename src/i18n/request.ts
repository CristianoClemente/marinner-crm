import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Idioma padrão do ambiente; PT-BR é o padrão do produto (Brasil)
  const locale = process.env.NEXT_PUBLIC_APP_LOCALE || 'pt-BR';

  let messages;
  try {
    messages = (await import(`../../messages/${locale}.json`)).default;
  } catch (error) {
    // Fallback para PT-BR caso o dicionário do locale solicitado não exista
    messages = (await import(`../../messages/pt-BR.json`)).default;
  }

  return {
    locale,
    messages
  };
});
