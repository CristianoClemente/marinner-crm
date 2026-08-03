"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle, UsersRound, ArrowRight, Loader2, Check } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/auth-errors";
import { normalizeSlug, validateSlug } from "@/lib/account/slug";
import { getTenantUrl } from "@/lib/domain";
import { isBillingCheckoutVisualOnly } from "@/lib/billing/visual-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/auth-alert";
import { SignupStepNav } from "@/components/auth/signup-step-nav";
import {
  PlanPicker,
  type PlanOption,
} from "@/components/auth/plan-picker";
import type { AuthBrand } from "@/components/auth/auth-brand";
import { DEFAULT_LOGO_SRC } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SIGNUP_PLAN_KEY = "marinner_signup_plan";

type Step = 0 | 1 | 2 | 3;

/**
 * Traduções e searchParams ficam no mesmo filho sob o
 * NextIntlClientProvider da page (server) — evita context missing.
 */
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
  const visualOnly = isBillingCheckoutVisualOnly();

  const [step, setStep] = useState<Step>(0);
  const [maxReached, setMaxReached] = useState<Step>(0);
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

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SIGNUP_PLAN_KEY);
      if (saved) setPlanCode(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (inviteToken) return;
    let cancelled = false;
    setLoadingPlans(true);
    (async () => {
      try {
        const res = await fetch("/api/billing/catalog");
        if (!res.ok) throw new Error("fail");
        const body = (await res.json()) as { plans?: PlanOption[] };
        if (!cancelled) setPlans(body.plans ?? []);
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

  const checkSlug = useCallback(
    async (value: string): Promise<boolean> => {
      const normalized = normalizeSlug(value);
      const local = validateSlug(normalized);
      if (!local.ok) {
        setSlugStatus("invalid");
        setSlugReason(local.error ?? "invalid_format");
        return false;
      }
      setSlugStatus("checking");
      setSlugReason(null);
      try {
        const res = await fetch(
          `/api/account/slug-check?slug=${encodeURIComponent(normalized)}`,
        );
        const body = (await res.json().catch(() => null)) as {
          available?: boolean;
          reason?: string;
        } | null;
        if (!res.ok) {
          setSlugStatus("invalid");
          setSlugReason("check_failed");
          return false;
        }
        if (body?.available) {
          setSlugStatus("ok");
          setSlugReason(null);
          return true;
        }
        setSlugStatus("taken");
        setSlugReason(body?.reason ?? "taken");
        return false;
      } catch {
        setSlugStatus("invalid");
        setSlugReason("check_failed");
        return false;
      }
    },
    [],
  );

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
      return t("slugAvailable", {
        url: getTenantUrl(normalizeSlug(slug) || "escola"),
      });
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

  const goToStep = (next: Step) => {
    setError(null);
    setStep(next);
    setMaxReached((prev) => (next > prev ? next : prev));
  };

  const finishSignup = async () => {
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      setStep(2);
      return;
    }
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      setStep(2);
      return;
    }

    if (!inviteToken) {
      if (!schoolName.trim()) {
        setStep(0);
        setError(t("schoolNameRequired"));
        return;
      }
      const ok = await checkSlug(slug);
      if (!ok) {
        setStep(0);
        setError(t("slugMustBeValid"));
        return;
      }
      if (!planCode) {
        setStep(1);
        setError(t("planRequired"));
        return;
      }
      if (!cpfCnpj.trim() || !phone.trim() || !postalCode.trim() || !addressNumber.trim()) {
        setStep(3);
        setError(t("billingRequired"));
        return;
      }
    }

    setLoading(true);
    const supabase = createClient();
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : `${window.location.origin}/login`;

    const meta: Record<string, string> = {
      full_name: fullName.trim(),
    };
    if (!inviteToken) {
      meta.school_name = schoolName.trim();
      meta.account_slug = normalizeSlug(slug);
      meta.plan_code = planCode;
      meta.billing_cpf_cnpj = cpfCnpj.trim();
      meta.billing_phone = phone.trim();
      meta.billing_postal_code = postalCode.trim();
      meta.billing_address_number = addressNumber.trim();
      try {
        sessionStorage.setItem(SIGNUP_PLAN_KEY, planCode);
      } catch {
        /* ignore */
      }
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: meta,
        emailRedirectTo,
      },
    });

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      setLoading(false);
      return;
    }

    // Fluxo desejado: cadastro completo → confirmar e-mail → login.
    // Se o Supabase devolver sessão (confirm e-mail desligado), encerra
    // a sessão para forçar o caminho “confirme e entre”.
    if (data.session) {
      await supabase.auth.signOut();
    }

    try {
      sessionStorage.removeItem(SIGNUP_PLAN_KEY);
    } catch {
      /* ignore */
    }

    setLoading(false);
    setSuccess(true);
  };

  const loginHref = inviteToken
    ? `/login?invite=${encodeURIComponent(inviteToken)}`
    : "/login";

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

  // Convite: formulário simples (sem accordion).
  if (inviteToken) {
    return (
      <AuthShell
        brand={brand}
        icon={<UsersRound className="size-6 text-primary" />}
        title={t("titleInvite")}
        description={
          brand ? t("descBrand", { name: brand.name }) : t("descInvite")
        }
        footer={
          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link href={loginHref} className="text-primary hover:text-primary/80">
              {t("signIn")}
            </Link>
          </p>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void finishSignup();
          }}
        >
          {error ? <AuthAlert>{error}</AuthAlert> : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("fullNamePlaceholder")}
              required
              className="h-11 border-border bg-muted"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              required
              className="h-11 border-border bg-muted"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("passwordLabel")}</Label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("passwordPlaceholder")}
              required
              className="h-11 border-border bg-muted"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirmPasswordPlaceholder")}
              required
              className="h-11 border-border bg-muted"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-11">
            {loading ? t("creating") : t("createAccount")}
          </Button>
        </form>
      </AuthShell>
    );
  }

  const logoSrc = brand?.logoUrl || DEFAULT_LOGO_SRC;
  const slugPreview = normalizeSlug(slug)
    ? getTenantUrl(normalizeSlug(slug))
    : null;

  const stepMeta = [
    {
      title: t("stepSchool"),
      heading: t("titleSchool"),
      description: t("descSchool"),
    },
    {
      title: t("stepPlan"),
      heading: t("titlePlan"),
      description: t("descPlan"),
    },
    {
      title: t("stepAccess"),
      heading: t("titleAccess"),
      description: t("descAccess"),
    },
    {
      title: t("stepBilling"),
      heading: t("titleBilling"),
      description: visualOnly ? tb("visualBanner") : t("descBilling"),
    },
  ] as const;

  const currentMeta = stepMeta[step];

  const navFooter = (
    <div className="space-y-2">
      {schoolName ? (
        <p>
          <span className="text-muted-foreground">{t("summarySchool")}: </span>
          <span className="text-foreground">{schoolName}</span>
        </p>
      ) : null}
      {slugPreview ? (
        <p className="break-all">
          <span className="text-muted-foreground">{t("summarySlug")}: </span>
          <span className="text-foreground">{slugPreview}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-4 py-8 sm:py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,var(--primary-soft),transparent)]"
      />
      <div className="relative w-full max-w-4xl overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
        <div className="grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
          <div className="border-b border-border p-4 md:border-b-0 md:border-r md:p-0">
            {/* Mobile: progresso compacto (círculos + etapa atual) */}
            <div className="md:hidden">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 p-1 ring-1 ring-primary/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoSrc} alt="" className="size-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t("titleWizard")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("stepOf", {
                      current: step + 1,
                      total: stepMeta.length,
                    })}
                    {" · "}
                    {currentMeta.title}
                  </p>
                </div>
              </div>
              <ol className="flex items-center" aria-label={t("stepLabel")}>
                {stepMeta.map((item, index) => {
                  const active = index === step;
                  const done = index < step;
                  const reachable = index <= maxReached;
                  return (
                    <li
                      key={item.title}
                      className={cn(
                        "flex items-center",
                        index < stepMeta.length - 1 ? "flex-1" : "shrink-0",
                      )}
                    >
                      <button
                        type="button"
                        disabled={!reachable}
                        onClick={() => goToStep(index as Step)}
                        aria-current={active ? "step" : undefined}
                        aria-label={`${t("stepLabel")} ${index + 1}: ${item.title}`}
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                          active &&
                            "bg-primary text-primary-foreground ring-2 ring-primary/25",
                          done &&
                            !active &&
                            "bg-primary/15 text-primary",
                          !done &&
                            !active &&
                            "bg-muted text-muted-foreground ring-1 ring-foreground/10",
                          !reachable && "opacity-50",
                        )}
                      >
                        {done && !active ? (
                          <Check className="size-3.5" strokeWidth={2.5} />
                        ) : (
                          index + 1
                        )}
                      </button>
                      {index < stepMeta.length - 1 ? (
                        <span
                          className={cn(
                            "mx-1.5 h-px min-w-0 flex-1",
                            index < step ? "bg-primary/50" : "bg-border",
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="hidden h-full md:block">
              <SignupStepNav
                steps={stepMeta.map((s) => ({ title: s.title }))}
                current={step}
                maxReached={maxReached}
                stepLabel={t("stepLabel")}
                onSelect={(index) => goToStep(index as Step)}
                footer={navFooter}
              />
            </div>
          </div>

          <div className="flex flex-col p-5 sm:p-8">
            <div className="mb-6 hidden items-center gap-3 md:flex">
              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 p-1.5 ring-1 ring-primary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="" className="size-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {t("titleWizard")}
                </p>
                <p className="text-xs text-muted-foreground">{t("descWizard")}</p>
              </div>
            </div>

            <div className="mb-5">
              <h1 className="text-xl font-medium tracking-tight text-foreground">
                {currentMeta.heading}
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {currentMeta.description}
              </p>
            </div>

            {error ? (
              <div className="mb-4">
                <AuthAlert>{error}</AuthAlert>
              </div>
            ) : null}

            {step === 0 ? (
              <form
                className="flex flex-1 flex-col gap-4"
                onSubmit={async (e) => {
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
                  goToStep(1);
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="schoolName">{t("schoolNameLabel")}</Label>
                  <Input
                    id="schoolName"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    onBlur={() => {
                      if (!slug.trim() && schoolName.trim()) {
                        setSlug(normalizeSlug(schoolName));
                      }
                    }}
                    placeholder={t("schoolNamePlaceholder")}
                    required
                    className="h-11 border-border bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("schoolNameHint")}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="slug">{t("slugLabel")}</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(normalizeSlug(e.target.value))}
                    placeholder={t("slugPlaceholder")}
                    required
                    className="h-11 border-border bg-muted"
                  />
                  <p
                    className={cn(
                      "text-xs",
                      slugStatus === "ok"
                        ? "text-primary"
                        : slugStatus === "taken" || slugStatus === "invalid"
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {slugStatus === "ok" ? (
                      <span className="break-all">
                        {getTenantUrl(normalizeSlug(slug))}
                      </span>
                    ) : (
                      slugHint
                    )}
                  </p>
                </div>
                <div className="mt-auto flex justify-end pt-4">
                  <Button type="submit" className="h-11 min-w-36">
                    {t("continue")}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </form>
            ) : null}

            {step === 1 ? (
              <form
                className="flex flex-1 flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  if (!planCode) {
                    setError(t("planRequired"));
                    return;
                  }
                  try {
                    sessionStorage.setItem(SIGNUP_PLAN_KEY, planCode);
                  } catch {
                    /* ignore */
                  }
                  goToStep(2);
                }}
              >
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
                <p className="text-xs text-muted-foreground">
                  {t("planTrialHint")}
                </p>
                <div className="mt-auto flex justify-end pt-4">
                  <Button type="submit" className="h-11 min-w-36">
                    {t("continue")}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </form>
            ) : null}

            {step === 2 ? (
              <form
                className="flex flex-1 flex-col gap-4"
                onSubmit={(e) => {
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
                  goToStep(3);
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fullName">{t("fullNameLabel")}</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("fullNamePlaceholder")}
                    required
                    className="h-11 border-border bg-muted"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t("emailLabel")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    required
                    className="h-11 border-border bg-muted"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t("passwordLabel")}</Label>
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("passwordPlaceholder")}
                    required
                    className="h-11 border-border bg-muted"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmPassword">
                    {t("confirmPasswordLabel")}
                  </Label>
                  <PasswordInput
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t("confirmPasswordPlaceholder")}
                    required
                    className="h-11 border-border bg-muted"
                  />
                </div>
                <div className="mt-auto flex justify-end pt-4">
                  <Button type="submit" className="h-11 min-w-36">
                    {t("continue")}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </form>
            ) : null}

            {step === 3 ? (
              <form
                className="flex flex-1 flex-col gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void finishSignup();
                }}
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cpfCnpj">{tb("cpfCnpjLabel")}</Label>
                  <Input
                    id="cpfCnpj"
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    placeholder={tb("cpfCnpjPlaceholder")}
                    required
                    className="h-11 border-border bg-muted"
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
                    className="h-11 border-border bg-muted"
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
                      className="h-11 border-border bg-muted"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="addressNumber">
                      {tb("addressNumberLabel")}
                    </Label>
                    <Input
                      id="addressNumber"
                      value={addressNumber}
                      onChange={(e) => setAddressNumber(e.target.value)}
                      placeholder="100"
                      required
                      className="h-11 border-border bg-muted"
                    />
                  </div>
                </div>
                <div className="mt-auto flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-11 min-w-44"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t("creating")}
                      </>
                    ) : (
                      t("finishSignup")
                    )}
                  </Button>
                </div>
              </form>
            ) : null}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {t("hasAccount")}{" "}
              <Link href="/login" className="text-primary hover:text-primary/80">
                {t("signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
