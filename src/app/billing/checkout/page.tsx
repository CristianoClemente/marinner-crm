"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  PlanPicker,
  type PlanOption,
} from "@/components/auth/plan-picker";
import { isBillingCheckoutVisualOnly } from "@/lib/billing/visual-only";

const SIGNUP_PLAN_KEY = "marinner_signup_plan";

type Translator = ReturnType<typeof useTranslations>;

export default function BillingCheckoutPage() {
  const t = useTranslations("BillingCheckout");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
    >
      <BillingCheckoutInner t={t} />
    </Suspense>
  );
}

function BillingCheckoutInner({ t }: { t: Translator }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resume = searchParams.get("resume") === "1";
  const { user, loading, profileLoading, isOwner, account } = useAuth();
  const visualOnly = isBillingCheckoutVisualOnly();

  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [planCode, setPlanCode] = useState("pro");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SIGNUP_PLAN_KEY);
      if (saved) setPlanCode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPlans = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const res = await fetch("/api/billing/catalog");
      if (!res.ok) throw new Error("fail");
      const body = (await res.json()) as { plans?: PlanOption[] };
      setPlans(body.plans ?? []);
    } catch {
      setError(t("loadPlansError"));
    } finally {
      setLoadingPlans(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (visualOnly) {
      try {
        sessionStorage.removeItem(SIGNUP_PLAN_KEY);
      } catch {
        /* ignore */
      }
      toast.message(t("visualDone"));
      router.push("/dashboard");
      return;
    }

    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          cpfCnpj,
          phone,
          postalCode,
          addressNumber,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        checkoutUrl?: string;
      } | null;
      if (!res.ok || !body?.checkoutUrl) {
        setError(body?.error ?? t("checkoutError"));
        setSubmitting(false);
        return;
      }
      try {
        sessionStorage.removeItem(SIGNUP_PLAN_KEY);
      } catch {
        /* ignore */
      }
      toast.success(t("redirecting"));
      window.location.href = body.checkoutUrl;
    } catch {
      setError(t("checkoutError"));
      setSubmitting(false);
    }
  };

  if (loading || profileLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const brand = account
    ? { name: account.name, logoUrl: account.logo_url }
    : null;

  if (!isOwner) {
    return (
      <AuthShell
        brand={brand}
        icon={<CreditCard className="size-6 text-primary" />}
        title={resume ? t("titleResume") : t("title")}
        description={t("ownerOnly")}
      >
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => router.push("/dashboard")}
        >
          Dashboard
        </Button>
      </AuthShell>
    );
  }

  const description = account?.name
    ? t("descWithSchool", { name: account.name })
    : t("description");

  return (
    <AuthShell
      brand={brand}
      icon={<CreditCard className="size-6 text-primary" />}
      title={resume ? t("titleResume") : t("title")}
      description={description}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {visualOnly ? (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-left text-sm text-muted-foreground ring-1 ring-foreground/5">
            {t("visualBanner")}
          </p>
        ) : null}
        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <div className="flex flex-col gap-2">
          <Label>{t("planLabel")}</Label>
          <PlanPicker
            plans={plans}
            value={planCode}
            onChange={setPlanCode}
            seatsLabel={(count) => t("seats", { count })}
            perMonthLabel={t("perMonth")}
            recommendedLabel={t("planRecommended")}
            loading={loadingPlans}
            loadingLabel={t("loadingPlans")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cpfCnpj">{t("cpfCnpjLabel")}</Label>
          <Input
            id="cpfCnpj"
            value={cpfCnpj}
            onChange={(e) => setCpfCnpj(e.target.value)}
            placeholder={t("cpfCnpjPlaceholder")}
            required
            className="h-11 border-border bg-muted text-base md:text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">{t("phoneLabel")}</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("phonePlaceholder")}
            required
            className="h-11 border-border bg-muted text-base md:text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="postalCode">{t("postalCodeLabel")}</Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="01310-100"
              required
              className="h-11 border-border bg-muted text-base md:text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="addressNumber">{t("addressNumberLabel")}</Label>
            <Input
              id="addressNumber"
              value={addressNumber}
              onChange={(e) => setAddressNumber(e.target.value)}
              placeholder="100"
              required
              className="h-11 border-border bg-muted text-base md:text-sm"
            />
          </div>
        </div>

        {visualOnly ? null : (
          <p className="text-sm text-muted-foreground">{t("trialHint")}</p>
        )}

        <Button type="submit" disabled={submitting || loadingPlans} className="h-11">
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("submitting")}
            </>
          ) : visualOnly ? (
            t("continueVisual")
          ) : (
            t("continueToAsaas")
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
