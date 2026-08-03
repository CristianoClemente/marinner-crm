"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { UsersRound } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { translateAuthError } from "@/lib/auth/auth-errors";
import { resolvePostLoginNavigation } from "@/lib/auth/post-login";
import { canShareAuthAcrossSubdomains } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthAlert } from "@/components/auth/auth-alert";
import type { AuthBrand } from "@/components/auth/auth-brand";

export type LoginLabels = {
  titleAccept: string;
  titleWelcome: string;
  descAccept: string;
  descWelcome: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  forgotPassword: string;
  passwordPlaceholder: string;
  signingIn: string;
  signIn: string;
  noAccount: string;
  createAccount: string;
};

export function LoginForm({
  labels,
  brand,
}: {
  labels: LoginLabels;
  brand?: AuthBrand | null;
}) {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const welcomeDesc = brand
    ? `Entre na conta de ${brand.name}`
    : labels.descWelcome;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(translateAuthError(signInError.message));
      setLoading(false);
      return;
    }

    let account: { id: string; slug: string | null } | null = null;
    try {
      const res = await fetch("/api/account");
      if (res.ok) {
        const body = (await res.json()) as {
          account?: { id?: string; slug?: string | null };
        };
        if (body.account?.id) {
          account = {
            id: body.account.id,
            slug: body.account.slug ?? null,
          };
        }
      }
    } catch {
      // resolvePostLoginNavigation trata account null
    }

    const next = resolvePostLoginNavigation({
      inviteToken,
      host: window.location.host,
      account,
      canShareAuth: canShareAuthAcrossSubdomains(),
    });

    if (next.kind === "sem-acesso") {
      window.location.href = "/sem-acesso";
      return;
    }

    window.location.href = next.href;
  };

  return (
    <AuthShell
      brand={inviteToken ? null : brand}
      icon={
        inviteToken ? (
          <UsersRound className="size-6 text-primary" />
        ) : undefined
      }
      title={inviteToken ? labels.titleAccept : labels.titleWelcome}
      description={inviteToken ? labels.descAccept : welcomeDesc}
      footer={
        <p className="text-center text-sm text-muted-foreground">
          {labels.noAccount}{" "}
          <Link
            href={
              inviteToken
                ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                : "/signup"
            }
            className="text-primary hover:text-primary/80"
          >
            {labels.createAccount}
          </Link>
        </p>
      }
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        {error ? <AuthAlert>{error}</AuthAlert> : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{labels.emailLabel}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={labels.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="password">{labels.passwordLabel}</Label>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:text-primary/80"
            >
              {labels.forgotPassword}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder={labels.passwordPlaceholder}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="h-11 border-border bg-muted text-base text-foreground md:text-sm"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-1 h-11 w-full"
        >
          {loading ? labels.signingIn : labels.signIn}
        </Button>
      </form>
    </AuthShell>
  );
}
