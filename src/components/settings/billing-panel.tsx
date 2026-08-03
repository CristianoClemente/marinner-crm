"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

import { useAuth } from "@/hooks/use-auth";
import type { Entitlements } from "@/lib/billing/entitlements";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SettingsPanelHead } from "./settings-panel-head";
import { settingsType } from "./settings-type";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function formatBrl(cents: number | undefined): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const STATUS_KEYS: Record<string, string> = {
  incomplete: "statusIncomplete",
  trialing: "statusTrialing",
  active: "statusActive",
  past_due: "statusPastDue",
  canceled: "statusCanceled",
};

export function BillingPanel() {
  const t = useTranslations("Settings.billing");
  const { canEditSettings, isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/subscription");
      if (!res.ok) throw new Error("fail");
      const body = (await res.json()) as { entitlements?: Entitlements };
      setEntitlements(body.entitlements ?? null);
    } catch {
      toast.error(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const statusKey = entitlements?.status
    ? STATUS_KEYS[entitlements.status] ?? "statusUnknown"
    : "statusNone";

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead title={t("title")} description={t("description")} />
      <Card>
        <CardHeader>
          <CardTitle className={cn("flex items-center gap-2", settingsType.sectionTitle)}>
            <CreditCard className="size-4 text-primary" aria-hidden />
            {t("title")}
          </CardTitle>
          <CardDescription className={settingsType.body}>
            {t("description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className={cn("flex items-center gap-2", settingsType.body)}>
              <Loader2 className="size-4 animate-spin" />
              {t("loading")}
            </div>
          ) : (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className={settingsType.meta}>{t("plan")}</dt>
                  <dd className="font-medium text-foreground">
                    {entitlements?.plan?.name ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className={settingsType.meta}>{t("price")}</dt>
                  <dd className="font-medium text-foreground">
                    {formatBrl(entitlements?.plan?.priceCents)}
                    {entitlements?.plan ? (
                      <span className="text-muted-foreground">/{t("perMonth")}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className={settingsType.meta}>{t("status")}</dt>
                  <dd className="font-medium text-foreground">{t(statusKey)}</dd>
                </div>
                <div>
                  <dt className={settingsType.meta}>{t("trialEnds")}</dt>
                  <dd className="font-medium text-foreground">
                    {formatDate(entitlements?.trialEndsAt ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className={settingsType.meta}>{t("periodEnd")}</dt>
                  <dd className="font-medium text-foreground">
                    {formatDate(entitlements?.currentPeriodEnd ?? null)}
                  </dd>
                </div>
                <div>
                  <dt className={settingsType.meta}>{t("seats")}</dt>
                  <dd className="font-medium text-foreground">
                    {entitlements?.maxSeats || "—"}
                  </dd>
                </div>
              </dl>

              {(isOwner || canEditSettings) && entitlements?.needsCheckout ? (
                <Link
                  href="/billing/checkout?resume=1"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "inline-flex h-10 min-h-11 sm:min-h-8",
                  )}
                >
                  {t("resumeCheckout")}
                </Link>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
