"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SemAcessoClient({ apexUrl }: { apexUrl: string }) {
  const t = useTranslations("TenantErrors");
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        {t("forbiddenCode")}
      </p>
      <h1 className="text-2xl font-semibold text-foreground">
        {t("forbiddenTitle")}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("forbiddenBody")}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link href={apexUrl} className={cn(buttonVariants())}>
          {t("forbiddenPortal")}
        </Link>
        <Button type="button" variant="outline" onClick={handleLogout}>
          {t("forbiddenSignOut")}
        </Button>
      </div>
    </main>
  );
}
