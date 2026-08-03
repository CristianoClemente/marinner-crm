"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle, KeyRound } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/auth-alert";
import type { AuthBrand } from "@/components/auth/auth-brand";

export function ResetPasswordForm({ brand }: { brand?: AuthBrand | null }) {
  const t = useTranslations("ResetPasswordPage");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setSessionReady(Boolean(data.user));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("tooShort"));
      return;
    }
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(translateAuthError(updateError.message));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (sessionReady === null) {
    return (
      <AuthShell brand={brand} title={t("title")} description={t("description")}>
        <p className="text-center text-sm text-muted-foreground">…</p>
      </AuthShell>
    );
  }

  if (!sessionReady) {
    return (
      <AuthShell
        brand={brand}
        icon={brand ? undefined : <KeyRound className="size-6 text-primary" />}
        title={t("title")}
        description={t("sessionMissing")}
      >
        <Link href="/forgot-password">
          <Button variant="outline" className="h-10 w-full">
            {t("backToLogin")}
          </Button>
        </Link>
      </AuthShell>
    );
  }

  if (success) {
    return (
      <AuthShell
        brand={brand}
        icon={brand ? undefined : <CheckCircle className="size-6 text-primary" />}
        title={t("successTitle")}
        description={t("successDesc")}
      >
        <Link href="/login">
          <Button className="h-10 w-full">{t("backToLogin")}</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      brand={brand}
      icon={brand ? undefined : <KeyRound className="size-6 text-primary" />}
      title={t("title")}
      description={t("description")}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error ? <AuthAlert>{error}</AuthAlert> : null}

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
          <Label htmlFor="confirm">{t("confirmLabel")}</Label>
          <PasswordInput
            id="confirm"
            autoComplete="new-password"
            placeholder={t("confirmPlaceholder")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
          />
        </div>

        <Button type="submit" disabled={loading} className="mt-1 h-11 w-full">
          {loading ? t("submitting") : t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
