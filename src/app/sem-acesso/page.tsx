import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { getApexUrl } from "@/lib/domain";
import { SemAcessoClient } from "./sem-acesso-client";

export default async function SemAcessoPage() {
  const locale = await getLocale();
  const messages = await getMessages();
  const scoped = {
    TenantErrors: (messages as Record<string, unknown>).TenantErrors,
  };

  return (
    <NextIntlClientProvider locale={locale} messages={scoped}>
      <SemAcessoClient apexUrl={getApexUrl()} />
    </NextIntlClientProvider>
  );
}
