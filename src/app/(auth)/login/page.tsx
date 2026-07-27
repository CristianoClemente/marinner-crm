import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";

// `useSearchParams` in LoginForm opts the tree out of static prerendering
// unless it sits under a Suspense boundary. Translations are resolved on
// the server and passed as plain props so the client form never needs
// NextIntlClientProvider context (avoids the SSR bailout error).
export default async function LoginPage() {
  const t = await getTranslations("LoginPage");

  return (
    <Suspense fallback={null}>
      <LoginForm
        labels={{
          titleAccept: t("titleAccept"),
          titleWelcome: t("titleWelcome"),
          descAccept: t("descAccept"),
          descWelcome: t("descWelcome"),
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
