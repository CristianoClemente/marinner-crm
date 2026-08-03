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
    <Card className="border-border bg-card ring-1 ring-foreground/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="size-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("loading")}
          </div>
        ) : (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("plan")}</dt>
                <dd className="font-medium text-foreground">
                  {entitlements?.plan?.name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("price")}</dt>
                <dd className="font-medium text-foreground">
                  {formatBrl(entitlements?.plan?.priceCents)}
                  {entitlements?.plan ? (
                    <span className="text-muted-foreground">/{t("perMonth")}</span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("status")}</dt>
                <dd className="font-medium text-foreground">{t(statusKey)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("trialEnds")}</dt>
                <dd className="font-medium text-foreground">
                  {formatDate(entitlements?.trialEndsAt ?? null)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("periodEnd")}</dt>
                <dd className="font-medium text-foreground">
                  {formatDate(entitlements?.currentPeriodEnd ?? null)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("seats")}</dt>
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
                  "inline-flex h-10",
                )}
              >
                {t("resumeCheckout")}
              </Link>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
