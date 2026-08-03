import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { DEFAULT_FAVICON_SRC } from "@/lib/brand";
import { getRequestTenant } from "@/lib/tenant/request";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getRequestTenant();
  const icon = tenant?.logoUrl || DEFAULT_FAVICON_SRC;
  return {
    title: tenant ? `Entrar — ${tenant.name}` : undefined,
    icons: {
      icon: [{ url: icon, type: icon.endsWith(".svg") ? "image/svg+xml" : undefined }],
    },
  };
}

export default async function LoginPage() {
  const t = await getTranslations("LoginPage");
  const tenant = await getRequestTenant();
  const brand = tenant
    ? {
        accountId: tenant.accountId,
        name: tenant.name,
        logoUrl: tenant.logoUrl,
      }
    : null;

  return (
    <Suspense fallback={null}>
      <LoginForm
        brand={brand}
        labels={{
          titleAccept: t("titleAccept"),
          titleWelcome: t("titleWelcome"),
          descAccept: t("descAccept"),
          descWelcome: t("descWelcome"),
          descBrand: t("descBrand"),
          emailLabel: t("emailLabel"),
          emailPlaceholder: t("emailPlaceholder"),
          passwordLabel: t("passwordLabel"),
          forgotPassword: t("forgotPassword"),
          passwordPlaceholder: t("passwordPlaceholder"),
          signingIn: t("signingIn"),
          signIn: t("signIn"),
          noAccount: t("noAccount"),
          createAccount: t("createAccount"),
        }}
      />
    </Suspense>
  );
}
