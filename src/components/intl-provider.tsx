"use client";

import { NextIntlClientProvider } from "next-intl";
import type { AbstractIntlMessages, IntlError } from "next-intl";
import { IntlErrorCode } from "next-intl";
import type { ReactNode } from "react";

/**
 * Wrapper client do NextIntlClientProvider.
 * onError / getMessageFallback precisam viver no client — o RootLayout
 * é Server Component e não pode serializar funções nas props.
 */
function onIntlError(error: IntlError): void {
  if (
    error.code === IntlErrorCode.MISSING_MESSAGE ||
    error.code === IntlErrorCode.INVALID_MESSAGE
  ) {
    // Chave ausente ou tag ICU inválida: não derruba a UI.
    // Corrija a mensagem no JSON; o fallback só protege o runtime.
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    throw error;
  }
}

function getIntlMessageFallback({
  namespace,
  key,
}: {
  namespace?: string;
  key: string;
}): string {
  return [namespace, key].filter(Boolean).join(".");
}

export function IntlProvider({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      onError={onIntlError}
      getMessageFallback={getIntlMessageFallback}
    >
      {children}
    </NextIntlClientProvider>
  );
}
