import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { getApexUrl } from "@/lib/domain";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function EscolaNaoEncontradaPage() {
  const t = await getTranslations("TenantErrors");
  const apex = getApexUrl();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {t("notFoundCode")}
      </p>
      <h1 className="text-2xl font-semibold text-foreground">
        {t("notFoundTitle")}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("notFoundBody")}</p>
      <Link href={apex} className={cn(buttonVariants())}>
        {t("notFoundCta")}
      </Link>
    </main>
  );
}
