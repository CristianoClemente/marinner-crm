"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckCircle, ArrowLeft, KeyRound } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/auth-alert";

export default function ForgotPasswordPage() {
  const t = useTranslations("ForgotPasswordPage");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );

    if (resetError) {
      setError(translateAuthError(resetError.message));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthShell
        icon={<CheckCircle className="size-6 text-primary" />}
        title={t("successTitle")}
        description={
          <>
            {t("successDescBefore")}{" "}
            <span className="text-foreground">{email}</span>
            {t("successDescAfter")}
          </>
        }
      >
        <Link href="/login">
          <Button variant="outline" className="h-10 w-full">
            {t("backToLogin")}
          </Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={<KeyRound className="size-6 text-primary" />}
      title={t("title")}
      description={t("description")}
      footer={
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {t("backToLogin")}
        </Link>
      }
    >
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        {error ? <AuthAlert>{error}</AuthAlert> : null}

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

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-11 w-full"
        >
          {loading ? t("sending") : t("submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
