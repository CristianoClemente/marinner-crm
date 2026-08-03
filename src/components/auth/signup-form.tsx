"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle,
  UsersRound,
  ArrowLeft,
  ArrowRight,
  CreditCard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/auth-errors";
import { normalizeSlug, validateSlug } from "@/lib/account/slug";
import { getTenantUrl } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthStepper } from "@/components/auth/auth-stepper";
import { AuthAlert } from "@/components/auth/auth-alert";
import {
  PlanPicker,
  type PlanOption,
} from "@/components/auth/plan-picker";
import type { AuthBrand } from "@/components/auth/auth-brand";

const SIGNUP_PLAN_KEY = "marinner_signup_plan";

type Step = 0 | 1 | 2 | 3;

export function SignupForm({ brand }: { brand?: AuthBrand | null }) {
  return (
    <Suspense fallback={null}>
      <SignupFormInner brand={brand} />
    </Suspense>
  );
}

function SignupFormInner({ brand }: { brand?: AuthBrand | null }) {
  const t = useTranslations("SignupPage");
  const tb = useTranslations("BillingCheckout");
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [step, setStep] = useState<Step>(0);
  const [schoolName, setSchoolName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "ok" | "taken" | "invalid"
  >("idle");
  const [slugReason, setSlugReason] = useState<string | null>(null);
  const [planCode, setPlanCode] = useState("pro");
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const steps = inviteToken
    ? [t("stepAccess")]
    : [t("stepSchool"), t("stepPlan"), t("stepAccess"), t("stepBilling")];

  const currentStepIndex = inviteToken ? 0 : step;

  useEffect(() => {
    if (inviteToken) return;
    let cancelled = false;
    setLoadingPlans(true);
    (async () => {
      try {
        const res = await fetch("/api/billing/catalog");
        if (!res.ok) throw new Error("catalog");
        const body = (await res.json()) as { plans?: PlanOption[] };
        if (cancelled) return;
        const list = body.plans ?? [];
        setPlans(list);
        if (list.some((p) => p.code === "pro")) setPlanCode("pro");
        else if (list[0]) setPlanCode(list[0].code);
      } catch {
        if (!cancelled) setError(tb("loadPlansError"));
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [inviteToken, tb]);

  const checkSlug = useCallback(async (raw: string) => {
    const local = validateSlug(raw);
    if (!local.ok) {
      setSlugStatus("invalid");
      setSlugReason(local.error ?? "invalid_format");
      return false;
    }

    setSlugStatus("checking");
    try {
      const res = await fetch(
        `/api/account/slug-check?slug=${encodeURIComponent(local.slug)}`,
      );
      if (!res.ok) {
        setSlugStatus("invalid");
        setSlugReason("check_failed");
        return false;
      }
      const body = (await res.json()) as {
        available?: boolean;
        reason?: string | null;
        slug?: string;
      };
      if (body.available) {
        setSlugStatus("ok");
        setSlugReason(null);
        if (body.slug) setSlug(body.slug);
        return true;
      }
      setSlugStatus("taken");
      setSlugReason(body.reason ?? "taken");
      return false;
    } catch {
      setSlugStatus("invalid");
      setSlugReason("check_failed");
      return false;
    }
  }, []);

  useEffect(() => {
    if (inviteToken) return;
    const normalized = normalizeSlug(slug);
    if (!normalized) {
      setSlugStatus("idle");
      setSlugReason(null);
      return;
    }
    const local = validateSlug(normalized);
    if (!local.ok) {
      setSlugStatus("invalid");
      setSlugReason(local.error ?? "invalid_format");
      return;
    }
    const handle = window.setTimeout(() => {
      void checkSlug(normalized);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [slug, inviteToken, checkSlug]);

  const slugHint = (() => {
    if (slugStatus === "checking") return t("slugChecking");
    if (slugStatus === "ok") {
      const preview = getTenantUrl(normalizeSlug(slug) || "escola");
      return t("slugAvailable", { url: preview });
    }
    if (slugStatus === "taken") return t("slugTaken");
    if (slugStatus === "invalid") {
      const map: Record<string, string> = {
        empty: t("slugEmpty"),
        too_short: t("slugTooShort"),
        too_long: t("slugTooLong"),
        invalid_format: t("slugInvalid"),
        reserved: t("slugReserved"),
        check_failed: t("slugCheckFailed"),
      };
      return map[slugReason ?? "invalid_format"] ?? t("slugInvalid");
    }
    return t("slugHint");
  })();

  const onSchoolNameBlur = () => {
    if (!slug.trim() && schoolName.trim()) {
      setSlug(normalizeSlug(schoolName));
    }
  };

  const persistPlan = (code: string) => {
    try {
      sessionStorage.setItem(SIGNUP_PLAN_KEY, code);
    } catch {
      /* ignore */
    }
  };

  const goToPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!schoolName.trim()) {
      setError(t("schoolNameRequired"));
      return;
    }
    const ok = await checkSlug(slug);
    if (!ok) {
      setError(t("slugMustBeValid"));
      return;
    }
    setStep(1);
  };

  const goToAccess = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!planCode) {
      setError(t("planRequired"));
      return;
    }
    persistPlan(planCode);
    setStep(2);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    if (!inviteToken) {
      const ok = await checkSlug(slug);
      if (!ok || !schoolName.trim()) {
        setStep(0);
        setError(t("slugMustBeValid"));
        return;
      }
      if (!planCode) {
        setStep(1);
        setError(t("planRequired"));
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const meta: Record<string, string> = {
      full_name: fullName.trim(),
    };
    if (!inviteToken) {
      meta.school_name = schoolName.trim();
      meta.account_slug = normalizeSlug(slug);
      meta.plan_code = planCode;
      persistPlan(planCode);
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: meta,
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      setLoading(false);
      return;
    }

    setLoading(false);

    if (inviteToken) {
      setSuccess(true);
      return;
    }

    if (data.session) {
      setStep(3);
      return;
    }

    setSuccess(true);
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
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
        setError(body?.error ?? tb("checkoutError"));
        setLoading(false);
        return;
      }
      try {
        sessionStorage.removeItem(SIGNUP_PLAN_KEY);
      } catch {
        /* ignore */
      }
      toast.success(tb("redirecting"));
      window.location.href = body.checkoutUrl;
    } catch {
      setError(tb("checkoutError"));
      setLoading(false);
    }
  };

  const loginHref = inviteToken
    ? `/login?invite=${encodeURIComponent(inviteToken)}`
    : "/login";

  const selectedPlan = plans.find((p) => p.code === planCode);

  if (success) {
    return (
      <AuthShell
        brand={brand}
        icon={<CheckCircle className="size-6 text-primary" />}
        title={t("successTitle")}
        description={
          <>
            {t("successDescBefore")}{" "}
            <span className="text-foreground">{email}</span>
            {t("successDescAfter")}
            {!inviteToken ? (
              <>
                {" "}
                {t("successBillingHint")}
              </>
            ) : null}
          </>
        }
      >
        <Link href={loginHref}>
          <Button variant="outline" className="h-10 w-full">
            {t("backToLogin")}
          </Button>
        </Link>
      </AuthShell>
    );
  }

  const title = inviteToken
    ? t("titleInvite")
    : step === 0
      ? t("titleSchool")
      : step === 1
        ? t("titlePlan")
        : step === 2
          ? t("titleAccess")
          : t("titleBilling");

  const description = inviteToken
    ? t("descInvite")
    : brand && step === 0
      ? t("descBrand", { name: brand.name })
      : step === 0
        ? t("descSchool")
        : step === 1
          ? t("descPlan")
          : step === 2
            ? t("descAccess")
            : t("descBilling");

  const shellSize = !inviteToken && (step === 1 || step === 3) ? "lg" : "md";

  return (
    <AuthShell
      brand={inviteToken ? null : brand}
      size={shellSize}
      icon={
        inviteToken ? (
          <UsersRound className="size-6 text-primary" />
        ) : step === 3 ? (
          <CreditCard className="size-6 text-primary" />
        ) : undefined
      }
      title={title}
      description={description}
      headerExtra={
        inviteToken ? undefined : (
          <AuthStepper steps={steps} current={currentStepIndex} />
        )
      }
      footer={
        step === 3 ? undefined : (
          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link
              href={loginHref}
              className="text-primary hover:text-primary/80"
            >
              {t("signIn")}
            </Link>
          </p>
        )
      }
    >
      {!inviteToken && step === 0 ? (
        <form onSubmit={goToPlan} className="flex flex-col gap-4">
          {error ? <AuthAlert>{error}</AuthAlert> : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="schoolName">{t("schoolNameLabel")}</Label>
            <Input
              id="schoolName"
              type="text"
              autoComplete="organization"
              placeholder={t("schoolNamePlaceholder")}
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              onBlur={onSchoolNameBlur}
              required
              maxLength={80}
              className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
            />
            <p className="text-sm text-muted-foreground">
              {t("schoolNameHint")}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="slug">{t("slugLabel")}</Label>
            <Input
              id="slug"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={t("slugPlaceholder")}
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
              }
              required
              className="h-11 border-border bg-muted font-mono text-base text-foreground md:text-sm"
            />
            <p
              className={
                slugStatus === "ok"
                  ? "text-sm text-primary"
                  : slugStatus === "taken" || slugStatus === "invalid"
                    ? "text-sm text-destructive"
                    : "text-sm text-muted-foreground"
              }
            >
              {slugHint}
            </p>
          </div>

          <Button
            type="submit"
            disabled={loading || slugStatus === "checking"}
            className="mt-1 h-11 w-full"
          >
            {t("continue")}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      ) : null}

      {!inviteToken && step === 1 ? (
        <form onSubmit={goToAccess} className="flex flex-col gap-4">
          {error ? <AuthAlert>{error}</AuthAlert> : null}

          <div className="rounded-lg bg-muted/60 px-3 py-2 text-left text-sm ring-1 ring-foreground/5">
            <p className="font-medium text-foreground">{schoolName}</p>
            <p className="truncate text-muted-foreground">
              {getTenantUrl(normalizeSlug(slug))}
            </p>
          </div>

          <PlanPicker
            plans={plans}
            value={planCode}
            onChange={setPlanCode}
            seatsLabel={(count) => tb("seats", { count })}
            perMonthLabel={tb("perMonth")}
            recommendedLabel={t("planRecommended")}
            loading={loadingPlans}
            loadingLabel={tb("loadingPlans")}
          />

          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("planTrialHint")}
          </p>

          <div className="mt-1 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 shrink-0"
              onClick={() => {
                setError(null);
                setStep(0);
              }}
            >
              <ArrowLeft className="size-4" />
              {t("back")}
            </Button>
            <Button
              type="submit"
              disabled={loadingPlans || !planCode}
              className="h-11 flex-1"
            >
              {t("continue")}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </form>
      ) : null}

      {(inviteToken || step === 2) && step !== 3 ? (
        <form onSubmit={handleSignup} className="flex flex-col gap-4">
          {error ? <AuthAlert>{error}</AuthAlert> : null}

          {!inviteToken ? (
            <div className="rounded-lg bg-muted/60 px-3 py-2 text-left text-sm ring-1 ring-foreground/5">
              <p className="font-medium text-foreground">{schoolName}</p>
              <p className="truncate text-muted-foreground">
                {getTenantUrl(normalizeSlug(slug))}
              </p>
              {selectedPlan ? (
                <p className="mt-1 text-xs text-primary">
                  {t("planSummary", { name: selectedPlan.name })}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              placeholder={t("fullNamePlaceholder")}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
            />
          </div>

          <div className="mt-1 flex gap-2">
            {!inviteToken ? (
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                disabled={loading}
              >
                <ArrowLeft className="size-4" />
                {t("back")}
              </Button>
            ) : null}
            <Button type="submit" disabled={loading} className="h-11 flex-1">
              {loading
                ? t("creating")
                : inviteToken
                  ? t("createAccount")
                  : t("continueToBilling")}
            </Button>
          </div>
        </form>
      ) : null}

      {!inviteToken && step === 3 ? (
        <form onSubmit={handleCheckout} className="flex flex-col gap-4">
          {error ? <AuthAlert>{error}</AuthAlert> : null}

          <div className="rounded-lg bg-muted/60 px-3 py-2 text-left text-sm ring-1 ring-foreground/5">
            <p className="font-medium text-foreground">{schoolName}</p>
            {selectedPlan ? (
              <p className="text-muted-foreground">
                {t("planSummary", { name: selectedPlan.name })}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cpfCnpj">{tb("cpfCnpjLabel")}</Label>
            <Input
              id="cpfCnpj"
              value={cpfCnpj}
              onChange={(e) => setCpfCnpj(e.target.value)}
              placeholder={tb("cpfCnpjPlaceholder")}
              required
              className="h-11 border-border bg-muted text-base md:text-sm"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">{tb("phoneLabel")}</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={tb("phonePlaceholder")}
              required
              className="h-11 border-border bg-muted text-base md:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">{tb("postalCodeLabel")}</Label>
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
              <Label htmlFor="addressNumber">{tb("addressNumberLabel")}</Label>
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

          <p className="text-sm text-muted-foreground">{tb("trialHint")}</p>

          <Button type="submit" disabled={loading} className="h-11 w-full">
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {tb("submitting")}
              </>
            ) : (
              tb("continueToAsaas")
            )}
          </Button>
        </form>
      ) : null}
    </AuthShell>
  );
}
