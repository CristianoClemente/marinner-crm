import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { DEFAULT_FAVICON_SRC } from "@/lib/brand";
import { getRequestTenant } from "@/lib/tenant/request";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  const icon = tenant?.logoUrl || DEFAULT_FAVICON_SRC;
  return {
    title: tenant ? `Nova senha — ${tenant.name}` : undefined,
    icons: {
      icon: [
        {
          url: icon,
          type: icon.endsWith(".svg") ? "image/svg+xml" : undefined,
        },
      ],
    },
  };
}

export default async function ResetPasswordPage() {
  const tenant = await getRequestTenant();
  const brand = tenant
    ? {
        accountId: tenant.accountId,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
      }
    : null;

  const locale = await getLocale();
  const messages = await getMessages();
  const scoped = {
    ResetPasswordPage: (messages as Record<string, unknown>).ResetPasswordPage,
  };

  return (
    <NextIntlClientProvider locale={locale} messages={scoped}>
      <ResetPasswordForm brand={brand} />
    </NextIntlClientProvider>
  );
}
