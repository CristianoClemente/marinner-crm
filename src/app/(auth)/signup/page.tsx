import { Suspense } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { SignupForm } from "@/components/auth/signup-form";
import { DEFAULT_FAVICON_SRC } from "@/lib/brand";
import { getRequestTenant } from "@/lib/tenant/request";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  const icon = tenant?.logoUrl || DEFAULT_FAVICON_SRC;
  return {
    title: tenant ? `Criar conta — ${tenant.name}` : undefined,
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

export default async function SignupPage() {
  const tenant = await getRequestTenant();
  const brand = tenant
    ? { name: tenant.name, logoUrl: tenant.logoUrl }
    : null;

  const locale = await getLocale();
  const messages = await getMessages();
  const scoped = {
    SignupPage: (messages as Record<string, unknown>).SignupPage,
    BillingCheckout: (messages as Record<string, unknown>).BillingCheckout,
  };

  // Provider local: evita “NextIntlClientProvider not found” quando o
  // Suspense de useSearchParams retenta o client sem o contexto do root.
  return (
    <NextIntlClientProvider locale={locale} messages={scoped}>
      <Suspense fallback={null}>
        <SignupForm brand={brand} />
      </Suspense>
    </NextIntlClientProvider>
  );
}
